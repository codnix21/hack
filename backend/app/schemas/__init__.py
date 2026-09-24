from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Auth ---
class UserRegister(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=6)
    full_name: str = ""


class UserLogin(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(ORMModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime


class GuestContinueResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    message: str = "Продолжение как гость"


# --- Catalog ---
class ManufacturerOut(ORMModel):
    id: int
    name: str
    country: Optional[str] = None
    website: Optional[str] = None
    archived: bool = False


class ManufacturerCreate(BaseModel):
    name: str
    country: Optional[str] = None
    website: Optional[str] = None


class ManufacturerUpdate(BaseModel):
    name: Optional[str] = None
    country: Optional[str] = None
    website: Optional[str] = None
    archived: Optional[bool] = None


class IndustryOut(ORMModel):
    id: int
    code: str
    name_ru: str


class ObjectTypeOut(ORMModel):
    id: int
    code: str
    name_ru: str
    industry_id: Optional[int] = None
    parameter_schema: Optional[dict] = None


class ObjectTypeCreate(BaseModel):
    code: str
    name_ru: str
    industry_id: Optional[int] = None
    parameter_schema: Optional[dict] = None


class ObjectTypeUpdate(BaseModel):
    code: Optional[str] = None
    name_ru: Optional[str] = None
    industry_id: Optional[int] = None
    parameter_schema: Optional[dict] = None


class SolutionTypeOut(ORMModel):
    id: int
    code: str
    name_ru: str


class SolutionTypeCreate(BaseModel):
    code: str
    name_ru: str


class SolutionTypeUpdate(BaseModel):
    code: Optional[str] = None
    name_ru: Optional[str] = None


class RobotOut(ORMModel):
    id: int
    manufacturer_id: Optional[int] = None
    name: str
    solution_type_id: Optional[int] = None
    purpose: Optional[str] = None
    country: Optional[str] = None
    availability_status: Optional[str] = None
    payload_kg: Optional[float] = None
    length_mm: Optional[float] = None
    width_mm: Optional[float] = None
    height_mm: Optional[float] = None
    speed_mps: Optional[float] = None
    productivity_ops_per_hour: Optional[float] = None
    autonomy_hours: Optional[float] = None
    positioning_accuracy_mm: Optional[float] = None
    navigation: Optional[str] = None
    operating_conditions: Optional[Any] = None
    infrastructure_requirements: Optional[Any] = None
    price_rub: Optional[float] = None
    software_cost_rub: Optional[float] = None
    implementation_cost_rub: Optional[float] = None
    maintenance_cost_year_rub: Optional[float] = None
    service_life_years: Optional[float] = None
    acquisition_model: Optional[str] = None
    supported_processes: Optional[Any] = None
    limitations: Optional[Any] = None
    cases: Optional[Any] = None
    source: Optional[str] = None
    source_url: Optional[str] = None
    updated_at: datetime
    confirmation_level: str
    archived: bool
    raw_data: Optional[Any] = None
    external_id: Optional[str] = None
    source_file: Optional[str] = None
    source_sheet: Optional[str] = None
    source_row: Optional[int] = None
    source_column: Optional[str] = None
    source_date: Optional[datetime] = None
    source_status: Optional[str] = None
    catalog_type_raw: Optional[str] = None
    subtype_raw: Optional[str] = None
    scenario_raw: Optional[str] = None
    cases_text: Optional[str] = None
    trl_level: Optional[int] = None
    market_potential: Optional[float] = None
    industry_raw: Optional[str] = None
    region_raw: Optional[str] = None
    data_origin: str = "demo"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def data_confidence(self) -> str:
        """Краткий статус полноты данных для UI."""
        origin = (self.data_origin or "demo").lower()
        if origin == "demo":
            return "Демонстрационные данные"

        has_company = self.manufacturer_id is not None or bool(
            (self.raw_data or {}).get("company") if isinstance(self.raw_data, dict) else False
        )
        has_core = bool(self.name) and self.price_rub is not None and has_company
        empty_fields = [
            f
            for f, v in [
                ("payload_kg", self.payload_kg),
                ("width_mm", self.width_mm),
                ("speed_mps", self.speed_mps),
                ("autonomy_hours", self.autonomy_hours),
                ("navigation", self.navigation),
                ("price_rub", self.price_rub),
                ("productivity_ops_per_hour", self.productivity_ops_per_hour),
            ]
            if v is None or v == ""
        ]
        if has_core and len(empty_fields) <= 2:
            return "Данные из исходных материалов"
        if len(empty_fields) >= 3 or not has_core:
            return "Частично заполнено"
        return "Данные из исходных материалов"


class RobotCreate(BaseModel):
    manufacturer_id: Optional[int] = None
    name: str
    solution_type_id: Optional[int] = None
    purpose: Optional[str] = None
    country: Optional[str] = None
    availability_status: Optional[str] = "available"
    payload_kg: Optional[float] = None
    length_mm: Optional[float] = None
    width_mm: Optional[float] = None
    height_mm: Optional[float] = None
    speed_mps: Optional[float] = None
    productivity_ops_per_hour: Optional[float] = None
    autonomy_hours: Optional[float] = None
    positioning_accuracy_mm: Optional[float] = None
    navigation: Optional[str] = None
    operating_conditions: Optional[Any] = None
    infrastructure_requirements: Optional[Any] = None
    price_rub: Optional[float] = None
    software_cost_rub: Optional[float] = None
    implementation_cost_rub: Optional[float] = None
    maintenance_cost_year_rub: Optional[float] = None
    service_life_years: Optional[float] = None
    acquisition_model: Optional[str] = None
    supported_processes: Optional[Any] = None
    limitations: Optional[Any] = None
    cases: Optional[Any] = None
    source: Optional[str] = None
    source_url: Optional[str] = None
    confirmation_level: str = "needs_review"
    archived: bool = False
    raw_data: Optional[Any] = None


class RobotUpdate(BaseModel):
    manufacturer_id: Optional[int] = None
    name: Optional[str] = None
    solution_type_id: Optional[int] = None
    purpose: Optional[str] = None
    country: Optional[str] = None
    availability_status: Optional[str] = None
    payload_kg: Optional[float] = None
    length_mm: Optional[float] = None
    width_mm: Optional[float] = None
    height_mm: Optional[float] = None
    speed_mps: Optional[float] = None
    productivity_ops_per_hour: Optional[float] = None
    autonomy_hours: Optional[float] = None
    positioning_accuracy_mm: Optional[float] = None
    navigation: Optional[str] = None
    operating_conditions: Optional[Any] = None
    infrastructure_requirements: Optional[Any] = None
    price_rub: Optional[float] = None
    software_cost_rub: Optional[float] = None
    implementation_cost_rub: Optional[float] = None
    maintenance_cost_year_rub: Optional[float] = None
    service_life_years: Optional[float] = None
    acquisition_model: Optional[str] = None
    supported_processes: Optional[Any] = None
    limitations: Optional[Any] = None
    cases: Optional[Any] = None
    source: Optional[str] = None
    source_url: Optional[str] = None
    confirmation_level: Optional[str] = None
    archived: Optional[bool] = None
    raw_data: Optional[Any] = None


class PaginatedRobots(BaseModel):
    items: list[RobotOut]
    total: int
    page: int
    page_size: int


# --- Projects ---
class ProjectCreate(BaseModel):
    name: str
    industry_id: Optional[int] = None
    object_type_id: Optional[int] = None
    description: Optional[str] = None
    region: Optional[str] = None
    work_mode: Optional[str] = None
    object_params: Optional[dict] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    industry_id: Optional[int] = None
    object_type_id: Optional[int] = None
    description: Optional[str] = None
    region: Optional[str] = None
    work_mode: Optional[str] = None
    status: Optional[str] = None
    object_params: Optional[dict] = None


class ProjectOut(ORMModel):
    id: int
    owner_id: Optional[int] = None
    name: str
    industry_id: Optional[int] = None
    object_type_id: Optional[int] = None
    description: Optional[str] = None
    region: Optional[str] = None
    work_mode: Optional[str] = None
    status: str
    object_params: Optional[dict] = None
    is_demo: bool
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    last_calc_at: Optional[datetime] = None


class ProjectParamsUpdate(BaseModel):
    object_params: dict


class ImportMapping(BaseModel):
    mapping: dict[str, str]
    confirm: bool = False


class ProjectSolutionOut(ORMModel):
    id: int
    project_id: int
    robot_id: int
    selected: bool
    match_score: Optional[float] = None
    match_reasons: Optional[Any] = None
    exclusion_reasons: Optional[Any] = None
    status: str


class ScenarioOut(ORMModel):
    id: int
    project_id: int
    code: str
    name_ru: str
    params: Optional[dict] = None
    results: Optional[dict] = None


class ScenarioUpdate(BaseModel):
    name_ru: Optional[str] = None
    params: Optional[dict] = None
    results: Optional[dict] = None


# --- Economics ---
class EconomicsRequest(BaseModel):
    robot_id: Optional[int] = None
    robots_count: Optional[int] = None
    peak_demand: Optional[float] = None
    productivity: Optional[float] = None
    utilization: float = 0.85
    availability: float = 0.95
    reserve: float = 0.1
    years: int = 5
    scenario: str = "purchase"
    overrides: Optional[dict] = None


class WhatIfRequest(BaseModel):
    base: EconomicsRequest
    changes: dict[str, Any]


class SensitivityRequest(BaseModel):
    base: EconomicsRequest
    parameter: str
    values: list[float]


# --- Admin ---
class NormativeOut(ORMModel):
    id: int
    code: str
    name_ru: str
    value: float
    unit: Optional[str] = None
    source: Optional[str] = None
    updated_at: datetime
    editable: bool


class NormativeUpdate(BaseModel):
    value: Optional[float] = None
    name_ru: Optional[str] = None
    unit: Optional[str] = None
    source: Optional[str] = None


class DataSourceOut(ORMModel):
    id: int
    name: str
    url: Optional[str] = None
    description: Optional[str] = None
    updated_at: datetime


class DataSourceCreate(BaseModel):
    name: str
    url: Optional[str] = None
    description: Optional[str] = None


class DataSourceUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None


class AuditLogOut(ORMModel):
    id: int
    user_id: Optional[int] = None
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    details: Optional[Any] = None
    created_at: datetime
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    entity_name: Optional[str] = None


class UserAdminUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    full_name: Optional[str] = None


class MessageOut(BaseModel):
    message: str
    details: Optional[Any] = None


class ImportBatchOut(ORMModel):
    id: int
    filename: str
    imported_at: datetime
    status: str
    total_rows: int
    added: int
    updated: int
    skipped: int
    errors: int
    warnings: int
    report_json: Optional[Any] = None
    notes: Optional[str] = None


class SourceImportPathRequest(BaseModel):
    path: Optional[str] = None


TokenResponse.model_rebuild()
