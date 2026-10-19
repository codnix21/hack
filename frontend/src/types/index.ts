export type UserRole = 'guest' | 'user' | 'admin' | 'vendor'

export interface User {
  id: number
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
  expires_at?: string | null
}

export interface AuthTokens {
  access_token: string
  token_type?: string
}

export interface AuthResponse extends AuthTokens {
  user: User
  message?: string
}

export type ProjectStatus = 'draft' | 'active' | 'archived' | 'completed' | string

export interface ProjectSummary {
  area_m2?: number | null
  robots_count?: number | null
  capex?: number | null
  payback_years?: number | null
  npv?: number | null
}

export interface LayoutObject {
  id: string
  kind: string
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  example?: boolean
  from_dxf?: boolean
}

export interface WarehouseLayout {
  version?: number
  unit: string
  width_m: number
  length_m: number
  objects: LayoutObject[]
  source?: string
  dxf_meta?: Record<string, unknown> | null
}

export interface Project {
  id: number
  owner_id?: number | null
  name: string
  industry_id?: number | null
  object_type_id?: number | null
  description?: string | null
  region?: string | null
  work_mode?: string | null
  status: ProjectStatus
  object_params?: ProjectParams | null
  layout?: WarehouseLayout | null
  is_demo: boolean
  is_archived: boolean
  public_token?: string | null
  published_at?: string | null
  expires_at?: string | null
  created_at: string
  updated_at: string
  last_calc_at?: string | null
  summary?: ProjectSummary | null
}

export interface ProjectCreatePayload {
  name: string
  industry_id?: number | null
  object_type_id?: number | null
  description?: string | null
  region?: string | null
  work_mode?: string | null
  object_params?: ProjectParams | null
}

export interface ProjectParams {
  [key: string]: string | number | boolean | null | undefined
}

export interface ProjectParamsResponse {
  object_params: ProjectParams
  parameter_schema?: Record<string, unknown> | null
}

export interface Robot {
  id: number
  manufacturer_id?: number | null
  name: string
  solution_type_id?: number | null
  purpose?: string | null
  country?: string | null
  availability_status?: string | null
  payload_kg?: number | null
  length_mm?: number | null
  width_mm?: number | null
  height_mm?: number | null
  speed_mps?: number | null
  productivity_ops_per_hour?: number | null
  autonomy_hours?: number | null
  positioning_accuracy_mm?: number | null
  navigation?: string | null
  operating_conditions?: unknown
  infrastructure_requirements?: unknown
  price_rub?: number | null
  software_cost_rub?: number | null
  implementation_cost_rub?: number | null
  maintenance_cost_year_rub?: number | null
  service_life_years?: number | null
  acquisition_model?: string | null
  supported_processes?: unknown
  limitations?: unknown
  cases?: unknown
  source?: string | null
  source_url?: string | null
  updated_at: string
  confirmation_level: string
  archived: boolean
  raw_data?: unknown
  external_id?: string | null
  source_file?: string | null
  source_sheet?: string | null
  source_row?: number | null
  source_column?: string | null
  source_date?: string | null
  source_status?: string | null
  catalog_type_raw?: string | null
  subtype_raw?: string | null
  scenario_raw?: string | null
  cases_text?: string | null
  trl_level?: number | null
  market_potential?: number | null
  industry_raw?: string | null
  region_raw?: string | null
  data_origin?: string
  data_confidence?: string
}

export interface CatalogFilters {
  search?: string
  manufacturer_id?: number
  solution_type_id?: number
  country?: string
  min_payload?: number
  max_payload?: number
  min_price?: number
  max_price?: number
  confirmation_level?: string
  data_origin?: string
  catalog_type_raw?: string
  subtype_raw?: string
  region_raw?: string
  industry_raw?: string
  scenario_raw?: string
  availability_status?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
  page?: number
  page_size?: number
  include_archived?: boolean
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface Manufacturer {
  id: number
  name: string
  country?: string | null
  website?: string | null
  archived?: boolean
}

export interface SolutionType {
  id: number
  code: string
  name_ru: string
}

export interface Industry {
  id: number
  code: string
  name_ru: string
}

export interface ObjectTypeMeta {
  id: number
  code: string
  name_ru: string
  industry_id?: number | null
  parameter_schema?: Record<string, unknown> | null
}

export interface CatalogMetaFilters {
  solution_types: SolutionType[]
  manufacturers: { id: number; name: string; country?: string | null }[]
  catalog_type_raw?: string[]
  subtype_raw?: string[]
  industry_raw?: string[]
  region_raw?: string[]
  scenario_raw?: string[]
  availability_status?: string[]
  data_origin?: string[]
}

export interface CatalogStats {
  total: number
  source_count: number
  demo_count: number
}

export interface CompareResponse {
  robots: Robot[]
  comparison: { field: string; values: Record<string, unknown> }[]
}

export interface MatchingResultItem {
  id?: number | null
  project_id?: number | null
  robot_id: number
  selected?: boolean
  match_score?: number | null
  score_label?: string | null
  match_reasons?: unknown
  exclusion_reasons?: unknown
  status: string
  robot_name?: string | null
  robot_payload_kg?: number | null
  robot_price_rub?: number | null
  recommended_count?: number | null
  recommendation_text?: string | null
  estimated_capex?: number | null
  estimated_payback_years?: number | null
  utilization_estimate?: number | null
  limitations?: string[]
  missing_checks?: string[]
  warnings?: string[]
}

export interface MatchingResultsResponse {
  project_id: number
  results: MatchingResultItem[]
  total?: number
  suitable?: number
  needs_review?: number
  excluded?: number
  read_only?: boolean
}

export interface EconomicsRequest {
  robot_id?: number | null
  robots_count?: number | null
  peak_demand?: number | null
  productivity?: number | null
  utilization?: number
  availability?: number
  reserve?: number
  years?: number
  scenario?: string
  overrides?: Record<string, number | string | boolean>
}

export interface EconomicsScenarioResult {
  scenario: string
  scenario_name_ru?: string
  robots_count: number
  robots_count_detail?: {
    robots_count?: number
    coefficients?: Record<string, number>
    formula?: string
  }
  fleet_capacity?: {
    selected_robots?: number
    recommended_robots?: number
    robots_count_source?: string
    fleet_capacity_ops_per_hour?: number
    peak_coverage?: number | null
    meets_peak_demand?: boolean
    peak_is_estimate?: boolean
    note?: string
    warnings?: string[]
    [key: string]: unknown
  }
  capex: {
    capex: number
    breakdown?: Record<string, number>
    component_sources?: Record<string, { origin?: string; note?: string }>
    breakdown_matches_total?: boolean
    formula?: string
  }
  opex: { opex_annual: number; breakdown?: Record<string, number>; formula?: string }
  depreciation?: {
    applicable?: boolean
    enabled?: boolean
    method?: string
    method_label_ru?: string
    depreciable_base?: number
    salvage_value?: number
    useful_life_years?: number
    annual_depreciation?: number | null
    schedule?: { year: number; amount: number; book_value_end?: number }[]
    notes?: string[]
    is_cash_outflow?: boolean
    asset_label?: string
    assumptions?: Record<string, unknown>
  }
  annual_effect: {
    annual_effect: number
    with_depreciation?: number | null
    depreciation_deducted?: number | null
    accounting_note?: string
    gross_operating_effect?: number | null
    net_annual_effect?: number | null
    components?: Record<string, number>
    note?: string
    labor_reduction_share?: number
    labor_reduction_is_assumption?: boolean
  }
  payback: { payback_years?: number | null; message?: string; [key: string]: unknown }
  roi: { roi_percent?: number | null; [key: string]: unknown }
  tco: {
    tco: number
    years?: number
    tco_scope?: string
    tco_note?: string
    initial_investment?: number
    opex_annual?: number
    remaining_manual_labor_annual?: number
    total_outlay_with_remaining_labor?: number
    [key: string]: unknown
  }
  cost_comparison?: Record<string, unknown>
  remaining_manual_labor_cost?: number | null
  npv?: { npv?: number | null; discount_rate?: number; message?: string }
  irr?: { irr?: number | null; message?: string }
  cashflows?: Array<{
    year: number
    cashflow?: number
    cumulative?: number
    discounted?: number
    [key: string]: unknown
  }>
  assumptions?: Record<string, number | string | boolean>
  assumption_flags?: Record<string, boolean>
  formulas?: Record<string, string>
  robot_id?: number | null
  input_warnings?: string[]
  model_warnings?: string[]
  inputs?: Record<string, unknown>
  [key: string]: unknown
}

export interface EconomicsCalculateResponse {
  calculation_id: number
  version: number
  results: EconomicsScenarioResult
}

export interface WhatIfResponse {
  base: EconomicsScenarioResult
  alternative: EconomicsScenarioResult
  delta: Record<string, number>
  changes: Record<string, unknown>
}

export interface SensitivityPoint {
  parameter: string
  value: number
  capex: number
  opex_annual: number
  annual_effect: number
  payback_years?: number | null
  roi_percent?: number | null
  tco: number
  robots_count: number
}

export interface SensitivityResponse {
  parameter: string
  rows: SensitivityPoint[]
  [key: string]: unknown
}

export interface FormulasResponse {
  formulas: Record<string, string>
  description?: string
  model_version?: string
}

export interface Scenario {
  id: number
  project_id: number
  code: string
  name_ru: string
  params?: Record<string, unknown> | null
  results?: Record<string, unknown> | null
}

export interface ImportPreview {
  columns: string[]
  sample_rows: Record<string, string>[]
  total_rows: number
  suggested_mapping?: Record<string, string>
  parsed_params?: ProjectParams
  mode?: string
  warnings?: string[]
  errors?: string[]
  filename?: string
  file_size_bytes?: number
  unrecognized_labels?: string[]
  ignored_columns?: string[]
}

export interface ImportValidationError {
  row: number
  column?: string
  message: string
  severity: 'error' | 'warning'
}

export interface ImportValidateResponse {
  valid: boolean
  mapping?: Record<string, string>
  row_count: number
  errors?: string[]
  warnings?: string[]
  mode?: string | null
  parsed_params?: ProjectParams
  will_overwrite?: string[]
  unmapped_columns?: string[]
  unrecognized_labels?: string[]
}

export interface ImportConfirmResponse {
  message: string
  object_params: ProjectParams
  updated_keys?: string[]
  overwritten_keys?: string[]
  warnings?: string[]
}

export interface CatalogImportResult {
  processed?: number
  created?: number
  updated?: number
  added?: number
  skipped?: number
  errors?: number | unknown[]
  warnings?: number | unknown[]
  message?: string
  total_rows?: number
  batch_id?: number
  [key: string]: unknown
}

export interface ImportBatch {
  id: number
  filename: string
  imported_at: string
  status: string
  total_rows: number
  added: number
  updated: number
  skipped: number
  errors: number
  warnings?: number
  report_json?: unknown
  notes?: string | null
}

export interface VisualizationLayout {
  width: number
  height: number
  /** пикселей сцены на метр */
  metersToPx?: number
  walls: { x1: number; y1: number; x2: number; y2: number }[]
  zones: {
    id: string
    name: string
    x: number
    y: number
    w: number
    h: number
    color?: string
    type?: string
    rotation?: number
  }[]
  routes: {
    id: string
    name?: string
    points: { x: number; y: number }[]
    blocked?: boolean
    blocked_reason?: string
    length_m?: number
    status?: string
  }[]
  tasks?: {
    id: string
    type: string
    source_id?: string
    destination_id?: string
    source_name: string
    destination_name: string
    status: string
    robot_id: string | null
    blocked_reason?: string
    route_id: string
    length_m: number
    blocked: boolean
    points: { x: number; y: number }[]
  }[]
  robots: {
    id: string
    name: string
    route_id: string
    task_id?: string | null
    speed: number
    color?: string
    x?: number
    y?: number
  }[]
  charging_stations: { id: string; name: string; x: number; y: number; type?: string }[]
  load_unload_points: { id: string; name: string; x: number; y: number; type?: string }[]
  robot_count: number
  raw?: BackendLayout
}

export interface BackendLayout {
  canvas?: { width_m?: number; length_m?: number; unit?: string }
  zones?: {
    id: string
    name: string
    x: number
    y: number
    width: number
    height: number
    type?: string
    color?: string
  }[]
  routes?: {
    id: string
    name?: string
    points: { x: number; y: number }[]
    blocked?: boolean
  }[]
  charging_stations?: { id: string; name: string; x: number; y: number; type?: string }[]
  load_unload_points?: { id: string; name: string; x: number; y: number; type?: string }[]
  robots?: {
    id: string
    x: number
    y: number
    heading_deg?: number
    route_id?: string
    name?: string
  }[]
  meta?: {
    robots_count?: number
    robots_spawned?: number
    object_kind?: string
    source?: string
    route_warnings?: string[]
    [key: string]: unknown
  }
}

export interface CalculationSummary {
  robot_count: number
  config_label?: string
  robots?: { id: string; name: string; quantity: number }[]
  metrics?: Record<string, number>
}

export interface Normative {
  id: number
  code: string
  name_ru: string
  value: number
  unit?: string | null
  source?: string | null
  updated_at: string
  editable: boolean
}

export interface DataSource {
  id: number
  name: string
  url?: string | null
  description?: string | null
  updated_at: string
}

export interface AuditLogEntry {
  id: number
  user_id?: number | null
  action: string
  entity_type?: string | null
  entity_id?: number | null
  details?: unknown
  created_at: string
  user_email?: string | null
  user_name?: string | null
  entity_name?: string | null
}

export interface ApiErrorBody {
  detail?:
    | string
    | {
        msg: string
        loc?: (string | number)[]
        type?: string
      }[]
    | {
        code?: string
        message?: string
        capability?: string
        errors?: { field?: string; code?: string; message?: string }[]
        warnings?: unknown[]
        checklist?: unknown[]
      }
  message?: string
}

/** @deprecated use ObjectTypeMeta */
export type ObjectType = string

export interface DictionaryItem {
  id: number
  code?: string
  name?: string
  name_ru?: string
  description?: string
  is_active?: boolean
}
