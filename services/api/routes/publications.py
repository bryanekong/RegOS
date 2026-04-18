from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from db import get_db
from models import Publication, RemediationTask
from typing import Optional

router = APIRouter()

@router.get("")
async def list_publications(
    severity: Optional[str] = None,
    framework: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(
        Publication.publication_id,
        Publication.title,
        Publication.pub_date,
        Publication.doc_type,
        Publication.source,
        Publication.classification,
        Publication.status,
        Publication.ingested_at,
        Publication.summary
    )
    
    if severity:
        query = query.where(text("classification->>'severity' = :severity")).params(severity=severity)
    if framework:
        query = query.where(text("classification->>'framework' = :framework")).params(framework=framework)
        
    query = query.order_by(Publication.pub_date.desc())
    result = await db.execute(query)
    
    publications = []
    for row in result.all():
        publications.append({
            "publication_id": str(row[0]),
            "title": row[1],
            "pub_date": row[2].isoformat() if row[2] else None,
            "doc_type": row[3],
            "source": row[4],
            "classification": row[5] or {},
            "status": row[6],
            "ingested_at": row[7].isoformat() if row[7] else None,
            "summary": row[8]
        })
    return publications

@router.get("/{id}")
async def get_publication(id: str, db: AsyncSession = Depends(get_db)):
    query = select(Publication).where(Publication.publication_id == id)
    result = await db.execute(query)
    pub = result.scalar_one_or_none()
    if not pub:
        raise HTTPException(status_code=404, detail="Publication not found")
        
    tasks_query = select(RemediationTask).where(RemediationTask.publication_id == id)
    tasks_result = await db.execute(tasks_query)
    tasks = tasks_result.scalars().all()
    
    return {
        "publication_id": str(pub.publication_id),
        "title": pub.title,
        "pub_date": pub.pub_date.isoformat() if pub.pub_date else None,
        "doc_type": pub.doc_type,
        "source": pub.source,
        "source_url": pub.source_url,
        "full_text": pub.full_text,
        "summary": pub.summary,
        "status": pub.status,
        "classification": pub.classification or {},
        "sections": pub.sections or [],
        "ingested_at": pub.ingested_at.isoformat() if pub.ingested_at else None,
        "tasks": [
            {
                "task_id": str(t.task_id),
                "policy_id": str(t.policy_id),
                "section_title": t.section_title,
                "change_type": t.change_type,
                "action_text": t.action_text,
                "severity": t.severity,
                "deadline": t.deadline.isoformat() if t.deadline else None,
                "status": t.status,
                "owner": t.owner
            } for t in tasks
        ]
    }
