from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.types import JSON

from app.database import Base
from app.models.user import utcnow


class Robot(Base):
    __tablename__ = "robots"

    id = Column(Integer, primary_key=True, index=True)
    manufacturer_id = Column(Integer, ForeignKey("manufacturers.id"), nullable=True)
    name = Column(String(255), nullable=False, index=True)
    solution_type_id = Column(Integer, ForeignKey("solution_types.id"), nullable=True)
    purpose = Column(Text, nullable=True)
    country = Column(String(128), nullable=True)
    availability_status = Column(String(64), nullable=True, default="available")
    payload_kg = Column(Float, nullable=True)
    length_mm = Column(Float, nullable=True)
    width_mm = Column(Float, nullable=True)
    height_mm = Column(Float, nullable=True)
    speed_mps = Column(Float, nullable=True)
    productivity_ops_per_hour = Column(Float, nullable=True)
    autonomy_hours = Column(Float, nullable=True)
    positioning_accuracy_mm = Column(Float, nullable=True)
    navigation = Column(String(128), nullable=True)
    operating_conditions = Column(JSON, nullable=True)
    infrastructure_requirements = Column(JSON, nullable=True)
    price_rub = Column(Float, nullable=True)
    software_cost_rub = Column(Float, nullable=True)
    implementation_cost_rub = Column(Float, nullable=True)
    maintenance_cost_year_rub = Column(Float, nullable=True)
    service_life_years = Column(Float, nullable=True)
    acquisition_model = Column(String(64), nullable=True)  # purchase|raas|both
    supported_processes = Column(JSON, nullable=True)
    limitations = Column(JSON, nullable=True)
    cases = Column(JSON, nullable=True)
    source = Column(String(255), nullable=True)
    source_url = Column(String(512), nullable=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    confirmation_level = Column(String(32), default="needs_review", nullable=False)
    archived = Column(Boolean, default=False, nullable=False)
    raw_data = Column(JSON, nullable=True)

    # Provenance / source catalog
    external_id = Column(String(64), unique=True, nullable=True, index=True)
    source_file = Column(String(512), nullable=True)
    source_sheet = Column(String(255), nullable=True)
    source_row = Column(Integer, nullable=True)
    source_column = Column(String(128), nullable=True)
    source_date = Column(DateTime, nullable=True)
    source_status = Column(String(32), nullable=True)  # confirmed|needs_review|assumption|from_source
    catalog_type_raw = Column(String(64), nullable=True)  # brs|bas|software
    subtype_raw = Column(String(255), nullable=True)
    scenario_raw = Column(Text, nullable=True)
    cases_text = Column(Text, nullable=True)
    trl_level = Column(Integer, nullable=True)
    market_potential = Column(Float, nullable=True)
    industry_raw = Column(String(255), nullable=True)
    region_raw = Column(String(255), nullable=True)
    data_origin = Column(String(32), default="demo", nullable=False)  # source|demo|enriched


class RobotCharacteristic(Base):
    __tablename__ = "robot_characteristics"

    id = Column(Integer, primary_key=True, index=True)
    robot_id = Column(Integer, ForeignKey("robots.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    value = Column(String(512), nullable=True)
    unit = Column(String(64), nullable=True)
    source = Column(String(255), nullable=True)
    source_url = Column(String(512), nullable=True)
    obtained_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    confirmation_status = Column(String(32), default="needs_review", nullable=False)
