from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.types import JSON

from app.database import Base


class Industry(Base):
    __tablename__ = "industries"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(64), unique=True, nullable=False)
    name_ru = Column(String(255), nullable=False)


class ObjectType(Base):
    __tablename__ = "object_types"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(64), unique=True, nullable=False)
    name_ru = Column(String(255), nullable=False)
    industry_id = Column(Integer, ForeignKey("industries.id"), nullable=True)
    parameter_schema = Column(JSON, nullable=True)


class SolutionType(Base):
    __tablename__ = "solution_types"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(64), unique=True, nullable=False)
    name_ru = Column(String(255), nullable=False)
