from sqlalchemy import Boolean, Column, Integer, String, Text

from app.database import Base


class Manufacturer(Base):
    __tablename__ = "manufacturers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    country = Column(String(128), nullable=True)
    website = Column(String(512), nullable=True)
    archived = Column(Boolean, default=False, nullable=False)
