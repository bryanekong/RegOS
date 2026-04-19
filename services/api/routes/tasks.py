from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
from typing import Optional
from datetime import date
from db import get_db
from models import RemediationTask

router = APIRouter()


def _serialize(t: RemediationTask) -> dict:
    return {
        "task_id": str(t.task_id),
        "publication_id": str(t.publication_id) if t.publication_id else None,
        "policy_id": str(t.policy_id) if t.policy_id else None,
        "policy_section_id": t.policy_section_id,
        "section_title": t.section_title,
        "change_type": t.change_type,
        "action_text": t.action_text,
        "severity": t.severity,
        "deadline": t.deadline.isoformat() if t.deadline else None,
        "status": t.status,
        "owner": t.owner,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }

class TaskUpdate(BaseModel):
    status: Optional[str] = None
    owner: Optional[str] = None

@router.get("")
async def list_tasks(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(RemediationTask).order_by(RemediationTask.deadline.asc())
    
    if status:
        query = query.where(RemediationTask.status == status)
    if severity:
        query = query.where(RemediationTask.severity == severity)
        
    result = await db.execute(query)
    tasks = result.scalars().all()
    return [_serialize(t) for t in tasks]


@router.get("/overdue")
async def list_overdue_tasks(db: AsyncSession = Depends(get_db)):
    """Open or in-progress tasks whose deadline has passed."""
    today = date.today()
    query = (
        select(RemediationTask)
        .where(
            RemediationTask.deadline.is_not(None),
            RemediationTask.deadline < today,
            RemediationTask.status.in_(['open', 'in_progress']),
        )
        .order_by(RemediationTask.deadline.asc())
    )
    result = await db.execute(query)
    return [_serialize(t) for t in result.scalars().all()]

@router.patch("/{id}")
async def update_task_route(id: str, payload: TaskUpdate, db: AsyncSession = Depends(get_db)):
    query = select(RemediationTask).where(RemediationTask.task_id == id)
    result = await db.execute(query)
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    update_data = {}
    if payload.status is not None:
        update_data["status"] = payload.status
    if payload.owner is not None:
        update_data["owner"] = payload.owner
        
    if update_data:
        stmt = update(RemediationTask).where(RemediationTask.task_id == id).values(**update_data)
        await db.execute(stmt)
        await db.commit()
        await db.refresh(task)
        
    return {
        "task_id": str(task.task_id),
        "status": task.status,
        "owner": task.owner
    }
