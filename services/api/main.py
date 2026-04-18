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
    
    # seed policies synchronously
    seed_policies()
    
    yield
    await engine.dispose()

app = FastAPI(title="RegOS API", version="1.0.0", lifespan=lifespan)

origins = [
    "*",
    "http://localhost:3000",
    "http://localhost:5173"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = os.getenv('API_KEY', 'regos-proto-2026')

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
