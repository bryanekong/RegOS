from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, insert, text, update, delete
from sqlalchemy.exc import IntegrityError
from db import get_db
from models import PipelineQueue, Publication
from datetime import datetime, timezone, timedelta
import hashlib

router = APIRouter()

# Jobs still 'processing' after this long are assumed orphaned (worker crashed
# between claim and completion) and are reset to 'pending' so they can be retried.
STUCK_JOB_THRESHOLD = timedelta(minutes=5)

@router.get("/pipeline/status")
async def get_pipeline_status(db: AsyncSession = Depends(get_db)):
    # Group by stage, status
    query = select(
        PipelineQueue.stage,
        PipelineQueue.status,
        func.count(PipelineQueue.id).label('count')
    ).group_by(PipelineQueue.stage, PipelineQueue.status)
    
    result = await db.execute(query)
    
    queues = {
        f"stage{i}": {"pending": 0, "processing": 0, "done": 0, "failed": 0} 
        for i in range(1, 6)
    }
    
    for stage, status, count in result.all():
        if stage in queues:
            if status not in queues[stage]:
                queues[stage][status] = 0
            queues[stage][status] = count

    # Last ingestion
    last_ingestion_query = select(func.max(Publication.ingested_at))
    last_ingestion_res = await db.execute(last_ingestion_query)
    last_ingestion = last_ingestion_res.scalar_one_or_none()

    return {
        "queues": queues,
        "last_ingestion": last_ingestion.isoformat() if last_ingestion else None
    }

@router.post("/ingest/trigger")
async def trigger_demo_ingest(db: AsyncSession = Depends(get_db)):
    # Insert synthetic demo publication
    pub_date = datetime.now(timezone.utc)
    title = 'FCA Consumer Duty: Final Guidance on Monitoring Consumer Outcomes'
    source_url = 'https://www.fca.org.uk/publications/finalised-guidance/fg22-5-consumer-duty'
    # Hash on title+url only (not timestamp) so repeated triggers reuse the same publication
    content_hash = hashlib.sha256((title + source_url).encode()).hexdigest()
    
    pub_data = {
        "source": 'FCA',
        "title": title,
        "pub_date": pub_date,
        "doc_type": 'FinalRule',
        "source_url": source_url,
        "summary": 'FCA final guidance under PRIN 2A requiring firms to monitor consumer outcomes.',
        "full_text": 'This guidance sets out FCA expectations under the Consumer Duty PRIN 2A.1 through PRIN 2A.4. Firms must implement cross-cutting rules ensuring fair value, consumer understanding and consumer support for vulnerable customers. The Consumer Principle requires all firms to act to deliver good outcomes for retail customers. The price and value outcome under COCON 4.1 requires assessment of whether prices are reasonable relative to overall benefits. Products and services must be designed to meet the needs of the target market. This final rule comes into force and firms must comply by 31 July 2024. Failure to comply may result in enforcement action under FCA Consumer Duty Rule.',
        "content_hash": content_hash,
        "status": 'pending',
        "ingested_at": pub_date
    }
    
    try:
        stmt = insert(Publication).values(**pub_data).returning(Publication.publication_id)
        result = await db.execute(stmt)
        await db.commit()
        pub_id = result.scalar_one()
    except IntegrityError:
        await db.rollback()
        query = select(Publication.publication_id).where(Publication.content_hash == content_hash)
        res = await db.execute(query)
        pub_id = res.scalar_one()
        
    # Only queue a new run if no active run exists for this publication
    active_check = select(func.count(PipelineQueue.id)).where(
        PipelineQueue.payload.op('->>')('publication_id') == str(pub_id),
        PipelineQueue.status.in_(['pending', 'processing'])
    )
    active_count = (await db.execute(active_check)).scalar_one()

    if active_count == 0:
        queue_data = {
            "stage": "stage1",
            "payload": {"publication_id": str(pub_id)}
        }
        await db.execute(insert(PipelineQueue).values(**queue_data))
        await db.commit()

    return {"triggered": True, "publication_id": str(pub_id)}


@router.post("/pipeline/sweep")
async def sweep_stuck_jobs(db: AsyncSession = Depends(get_db)):
    """Reset jobs stuck in 'processing' past the threshold and re-notify.
    Safe to call repeatedly — only rows older than STUCK_JOB_THRESHOLD are touched."""
    cutoff = datetime.now(timezone.utc) - STUCK_JOB_THRESHOLD
    result = await db.execute(
        text("""
            UPDATE pipeline_queue
               SET status = 'pending'
             WHERE status = 'processing'
               AND created_at < :cutoff
         RETURNING id, stage
        """),
        {"cutoff": cutoff},
    )
    rows = result.all()
    for row_id, stage in rows:
        await db.execute(text("SELECT pg_notify(:ch, :payload)"),
                         {"ch": stage, "payload": str(row_id)})
    await db.commit()
    return {"swept": len(rows), "ids": [r[0] for r in rows]}


@router.post("/pipeline/retry/{queue_id}")
async def retry_failed_job(queue_id: int, db: AsyncSession = Depends(get_db)):
    """Manually retry a dead-lettered job. Resets attempts to 0 and re-notifies."""
    result = await db.execute(
        text("""
            UPDATE pipeline_queue
               SET status = 'pending', attempts = 0, last_error = NULL
             WHERE id = :id AND status = 'failed'
         RETURNING stage
        """),
        {"id": queue_id},
    )
    row = result.first()
    if not row:
        return {"retried": False, "reason": "not found or not in failed state"}
    await db.execute(text("SELECT pg_notify(:ch, :payload)"),
                     {"ch": row[0], "payload": str(queue_id)})
    await db.commit()
    return {"retried": True, "queue_id": queue_id, "stage": row[0]}


@router.post("/pipeline/clear")
async def clear_pipeline(
    statuses: str = "pending,processing,failed",
    db: AsyncSession = Depends(get_db),
):
    """Delete queue rows in the given statuses. Defaults to all non-done rows
    so the dashboard goes back to idle. Pass ?statuses=failed to only clear
    dead-lettered jobs."""
    wanted = [s.strip() for s in statuses.split(',') if s.strip()]
    if not wanted:
        return {"cleared": 0, "statuses": []}
    # Use ORM delete with in_() — mixing a Python list into a raw text()
    # :bindparam as a PG array does not work reliably across drivers.
    stmt = delete(PipelineQueue).where(PipelineQueue.status.in_(wanted))
    result = await db.execute(stmt)
    await db.commit()
    return {"cleared": result.rowcount or 0, "statuses": wanted}


@router.get("/pipeline/failed")
async def list_failed_jobs(db: AsyncSession = Depends(get_db), limit: int = 50):
    """List dead-lettered jobs for the ops UI to show/retry."""
    q = (
        select(
            PipelineQueue.id, PipelineQueue.stage, PipelineQueue.payload,
            PipelineQueue.attempts, PipelineQueue.last_error,
            PipelineQueue.created_at, PipelineQueue.processed_at,
        )
        .where(PipelineQueue.status == 'failed')
        .order_by(PipelineQueue.processed_at.desc().nullslast())
        .limit(limit)
    )
    rows = (await db.execute(q)).all()
    return [
        {
            "id": r.id, "stage": r.stage, "payload": r.payload,
            "attempts": r.attempts, "last_error": r.last_error,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "processed_at": r.processed_at.isoformat() if r.processed_at else None,
        }
        for r in rows
    ]
