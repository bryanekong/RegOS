from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, insert
from sqlalchemy.exc import IntegrityError
from db import get_db
from models import PipelineQueue, Publication
from datetime import datetime, timezone
import hashlib

router = APIRouter()

@router.get("/status")
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
    content_hash = hashlib.sha256((title + source_url + str(pub_date)).encode()).hexdigest()
    
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
        
    queue_data = {
        "stage": "stage1",
        "payload": {
            "publication_id": str(pub_id)
        }
    }
    await db.execute(insert(PipelineQueue).values(**queue_data))
    await db.commit()
    
    return {"triggered": True, "publication_id": str(pub_id)}
