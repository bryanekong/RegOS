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

async def _safe_exec(engine_, sql: str, label: str):
    """Run a DDL/DML statement in its own transaction so one failure can't
    abort the whole startup sequence and leave the app unable to serve
    requests (including CORS preflight)."""
    try:
        async with engine_.begin() as conn:
            await conn.execute(text(sql))
    except Exception as e:
        logger.error(f"Startup step '{label}' failed (continuing): {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Each step runs in its own transaction — if any single DDL fails
    # (e.g. the UNIQUE constraint can't be added because duplicates exist),
    # the rest of startup still completes and the app can serve traffic.
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        logger.error(f"create_all failed (continuing): {e}")

    await _safe_exec(engine, """
        CREATE OR REPLACE FUNCTION notify_pipeline_stage() RETURNS trigger AS $$
        BEGIN PERFORM pg_notify(NEW.stage, NEW.id::text); RETURN NEW; END;
        $$ LANGUAGE plpgsql;
    """, "notify_pipeline_stage function")

    await _safe_exec(engine,
        "DROP TRIGGER IF EXISTS pipeline_queue_notify ON pipeline_queue;",
        "drop old trigger")
    await _safe_exec(engine, """
        CREATE TRIGGER pipeline_queue_notify AFTER INSERT ON pipeline_queue
        FOR EACH ROW EXECUTE FUNCTION notify_pipeline_stage();
    """, "create trigger")

    await _safe_exec(engine, """
        ALTER TABLE pipeline_queue
            ADD COLUMN IF NOT EXISTS attempts BIGINT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS last_error TEXT;
    """, "pipeline_queue attempts/last_error columns")

    # UNIQUE constraint may fail if duplicate tasks already exist — log and
    # move on rather than crashing the app.
    await _safe_exec(engine, """
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
    """, "remediation_tasks unique constraint")

    for idx_sql, label in [
        ("CREATE INDEX IF NOT EXISTS ix_remediation_task_publication_id ON remediation_tasks (publication_id);", "ix_rem_pub"),
        ("CREATE INDEX IF NOT EXISTS ix_remediation_task_policy_id ON remediation_tasks (policy_id);", "ix_rem_policy"),
        ("CREATE INDEX IF NOT EXISTS ix_remediation_task_status ON remediation_tasks (status);", "ix_rem_status"),
        ("CREATE INDEX IF NOT EXISTS ix_remediation_task_deadline ON remediation_tasks (deadline);", "ix_rem_deadline"),
        ("CREATE INDEX IF NOT EXISTS ix_pipeline_queue_status ON pipeline_queue (status);", "ix_queue_status"),
        ("CREATE INDEX IF NOT EXISTS ix_pipeline_queue_stage_status ON pipeline_queue (stage, status);", "ix_queue_stage_status"),
    ]:
        await _safe_exec(engine, idx_sql, label)

    # Reset jobs that were 'processing' during a previous crash/deploy so the
    # pipeline resumes instead of silently wedging on every restart.
    try:
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
    except Exception as e:
        logger.error(f"Startup stuck-job sweep failed (continuing): {e}")

    try:
        seed_policies()
    except Exception as e:
        logger.error(f"seed_policies failed (continuing): {e}")

    yield
    await engine.dispose()

app = FastAPI(title="RegOS API", version="1.0.0", lifespan=lifespan)

# Explicit allowed origins (via ALLOWED_ORIGINS env var, comma-separated) plus
# a regex to match any *.vercel.app preview/prod URL so ephemeral Vercel
# deployments work without re-deploying the backend for each one.
_default_origins = "http://localhost:3000,http://localhost:5173,https://reg-os.vercel.app"
origins = [o.strip() for o in os.getenv('ALLOWED_ORIGINS', _default_origins).split(',') if o.strip()]

if "*" in origins:
    logger.warning("CORS allow_origins includes '*' — acceptable for local dev only.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https://[a-z0-9-]+\.vercel\.app$",
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
