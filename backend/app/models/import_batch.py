from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.types import JSON

from app.database import Base
from app.models.user import utcnow


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(512), nullable=False)
    imported_at = Column(DateTime, default=utcnow, nullable=False)
    status = Column(String(64), nullable=False, default="completed")
    total_rows = Column(Integer, nullable=False, default=0)
    added = Column(Integer, nullable=False, default=0)
    updated = Column(Integer, nullable=False, default=0)
    skipped = Column(Integer, nullable=False, default=0)
    errors = Column(Integer, nullable=False, default=0)
    warnings = Column(Integer, nullable=False, default=0)
    report_json = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)
