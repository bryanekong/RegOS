import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

SUPABASE_DB_URL = os.getenv('SUPABASE_DB_URL')

if not SUPABASE_DB_URL:
    raise ValueError("SUPABASE_DB_URL environment variable is required")

engine = create_async_engine(
    SUPABASE_DB_URL,
    echo=False,
    poolclass=NullPool
)

AsyncSessionLocal = async_sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
