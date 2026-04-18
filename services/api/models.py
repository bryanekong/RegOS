from sqlalchemy import Column, Text, DateTime, JSON, BigInteger, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
import uuid

Base = declarative_base()

class Publication(Base):
    __tablename__ = "publications"

    publication_id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    source = Column(Text, server_default='FCA')
    title = Column(Text, nullable=False)
    pub_date = Column(DateTime(timezone=True))
    doc_type = Column(Text)
    source_url = Column(Text)
    full_text = Column(Text)
    summary = Column(Text)
    content_hash = Column(Text, unique=True)
    status = Column(Text, server_default='pending')
    classification = Column(JSON)
    sections = Column(JSON)
    ingested_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)

class Policy(Base):
    __tablename__ = "policies"

    policy_id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    title = Column(Text, nullable=False)
    doc_type = Column(Text)
    file_url = Column(Text)
    frameworks = Column(ARRAY(Text))
    reg_refs = Column(ARRAY(Text))
    sections = Column(JSON)
    status = Column(Text, server_default='active')
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class RemediationTask(Base):
    __tablename__ = "remediation_tasks"

    task_id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    publication_id = Column(UUID(as_uuid=True), ForeignKey('publications.publication_id'), nullable=True)
    policy_id = Column(UUID(as_uuid=True), ForeignKey('policies.policy_id'), nullable=True)
    policy_section_id = Column(Text)
    section_title = Column(Text)
    change_type = Column(Text)
    action_text = Column(Text)
    severity = Column(Text)
    deadline = Column(Date)
    status = Column(Text, server_default='open')
    owner = Column(Text, server_default='Compliance Team')
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class PipelineQueue(Base):
    __tablename__ = "pipeline_queue"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    stage = Column(Text, nullable=False)
    payload = Column(JSON, nullable=False)
    status = Column(Text, server_default='pending')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)
