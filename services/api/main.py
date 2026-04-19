import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
from db import engine
from models import Base
from seed import seed_policies
from sqlalchemy import text
from routes import publications, policies, tasks, pipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # run async create_all
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # executed raw SQL
        await conn.execute(text("""
            CREATE OR REPLACE FUNCTION notify_pipeline_stage() RETURNS trigger AS $$
            BEGIN PERFORM pg_notify(NEW.stage, NEW.id::text); RETURN NEW; END;
            $$ LANGUAGE plpgsql;
        """))
        await conn.execute(text("DROP TRIGGER IF EXISTS pipeline_queue_notify ON pipeline_queue;"))
        await conn.execute(text("""
            CREATE TRIGGER pipeline_queue_notify AFTER INSERT ON pipeline_queue
            FOR EACH ROW EXECUTE FUNCTION notify_pipeline_stage();
        """))

        # Idempotent schema patches for existing deployments (create_all only
        # creates new tables; it won't add constraints/columns to existing ones).
        await conn.execute(text("""
            ALTER TABLE pipeline_queue
                ADD COLUMN IF NOT EXISTS attempts BIGINT DEFAULT 0,
                ADD COLUMN IF NOT EXISTS last_error TEXT;
        """))
        await conn.execute(text("""
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'uq_remediation_task_pub_policy_section'
                ) THEN
                    ALTER TABLE remediation_tasks
                    ADD CONSTRAINT uq_remediation_task_pub_policy_section
                    UNIQUE (publication_id, policy_id, policy_section_id);
                END IF;
            END $$;
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_remediation_task_publication_id
                ON remediation_tasks (publication_id);
            CREATE INDEX IF NOT EXISTS ix_remediation_task_policy_id
                ON remediation_tasks (policy_id);
            CREATE INDEX IF NOT EXISTS ix_remediation_task_status
                ON remediation_tasks (status);
            CREATE INDEX IF NOT EXISTS ix_remediation_task_deadline
                ON remediation_tasks (deadline);
            CREATE INDEX IF NOT EXISTS ix_pipeline_queue_status
                ON pipeline_queue (status);
            CREATE INDEX IF NOT EXISTS ix_pipeline_queue_stage_status
                ON pipeline_queue (stage, status);
        """))
    
    # Reset jobs that were 'processing' during a previous crash/deploy so the
    # pipeline resumes instead of silently wedging on every restart.
    async with engine.begin() as conn:
        result = await conn.execute(text("""
            UPDATE pipeline_queue
               SET status = 'pending'
             WHERE status = 'processing'
               AND created_at < now() - interval '5 minutes'
         RETURNING id, stage
        """))
        stuck = result.all()
        for row_id, stage in stuck:
            await conn.execute(text("SELECT pg_notify(:ch, :p)"),
                               {"ch": stage, "p": str(row_id)})
        if stuck:
            logger.warning(f"Startup sweep re-queued {len(stuck)} stuck jobs")

    # seed policies synchronously
    seed_policies()

    yield
    await engine.dispose()

app = FastAPI(title="RegOS API", version="1.0.0", lifespan=lifespan)

# Comma-separated list of allowed origins, e.g.
#   ALLOWED_ORIGINS="https://regos.vercel.app,http://localhost:5173"
# A literal "*" is accepted for dev but logged as a warning at startup.
_default_origins = "http://localhost:3000,http://localhost:5173"
origins = [o.strip() for o in os.getenv('ALLOWED_ORIGINS', _default_origins).split(',') if o.strip()]

if "*" in origins:
    logger.warning("CORS allow_origins includes '*' — acceptable for local dev only.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = os.getenv('API_KEY')
if not API_KEY:
    # Fall back to a randomly generated per-process key so the service still
    # starts in environments that haven't set one, but make it extremely loud
    # that this is happening and that requests won't authenticate across restarts.
    import secrets
    API_KEY = secrets.token_urlsafe(32)
    logger.error(
        "API_KEY env var is not set. Generated an ephemeral key for this process; "
        "all external clients will fail to authenticate until API_KEY is configured."
    )

@app.middleware("http")
async def api_key_validator(request: Request, call_next):
    if request.url.path in ["/health", "/docs", "/openapi.json"]:
        return await call_next(request)
    if request.headers.get("X-API-Key") != API_KEY and request.method != "OPTIONS":
        return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
    return await call_next(request)

app.include_router(publications.router, prefix="/api/publications", tags=["publications"])
app.include_router(policies.router, prefix="/api/policies", tags=["policies"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(pipeline.router, prefix="/api", tags=["pipeline"])

@app.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
