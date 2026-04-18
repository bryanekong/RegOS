from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from db import get_db
from models import Policy, RemediationTask

router = APIRouter()

@router.get("")
async def list_policies(db: AsyncSession = Depends(get_db)):
    query = select(
        Policy,
        func.count(RemediationTask.task_id).label('open_task_count')
    ).outerjoin(
        RemediationTask,
        (RemediationTask.policy_id == Policy.policy_id) & (RemediationTask.status == 'open')
    ).group_by(Policy.policy_id).order_by(Policy.title)
    
    result = await db.execute(query)
    policies = []
    
    for policy, open_task_count in result.all():
        policies.append({
            "policy_id": str(policy.policy_id),
            "title": policy.title,
            "doc_type": policy.doc_type,
            "frameworks": policy.frameworks or [],
            "reg_refs": policy.reg_refs or [],
            "sections": policy.sections or [],
            "status": policy.status,
            "open_task_count": open_task_count
        })
    return policies

@router.get("/{id}")
async def get_policy(id: str, db: AsyncSession = Depends(get_db)):
    query = select(Policy).where(Policy.policy_id == id)
    result = await db.execute(query)
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
        
    tasks_query = select(RemediationTask).where(RemediationTask.policy_id == id)
    tasks_result = await db.execute(tasks_query)
    tasks = tasks_result.scalars().all()
    
    tasks_by_section = {}
    for task in tasks:
        sec_id = task.policy_section_id
        if sec_id not in tasks_by_section:
            tasks_by_section[sec_id] = []
        tasks_by_section[sec_id].append({
            "task_id": str(task.task_id),
            "publication_id": str(task.publication_id),
            "change_type": task.change_type,
            "action_text": task.action_text,
            "severity": task.severity,
            "status": task.status,
            "deadline": task.deadline.isoformat() if task.deadline else None,
            "owner": task.owner
        })
        
    return {
        "policy_id": str(policy.policy_id),
        "title": policy.title,
        "doc_type": policy.doc_type,
        "file_url": policy.file_url,
        "frameworks": policy.frameworks or [],
        "reg_refs": policy.reg_refs or [],
        "status": policy.status,
        "sections": [
            {
                **section,
                "tasks": tasks_by_section.get(section.get('id'), [])
            } for section in (policy.sections or [])
        ]
    }
