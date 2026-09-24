export type UserRole = 'guest' | 'user' | 'admin' | 'vendor'

export interface User {
  id: number
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
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
  is_demo: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
  last_calc_at?: string | null
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
  id: number
  project_id: number
  robot_id: number
  selected: boolean
  match_score?: number | null
  match_reasons?: unknown
  exclusion_reasons?: unknown
  status: string
  robot_name?: string | null
  robot_payload_kg?: number | null
  robot_price_rub?: number | null
}

export interface MatchingResultsResponse {
  project_id: number
  results: MatchingResultItem[]
  total?: number
  suitable?: number
  needs_review?: number
  excluded?: number
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
  capex: { capex: number; breakdown?: Record<string, number>; formula?: string }
  opex: { opex_annual: number; breakdown?: Record<string, number>; formula?: string }
  annual_effect: { annual_effect: number; components?: Record<string, number> }
  payback: { payback_years?: number | null; [key: string]: unknown }
  roi: { roi_percent?: number | null; [key: string]: unknown }
  tco: { tco: number; years?: number }
  assumptions?: Record<string, number | string | boolean>
  formulas?: Record<string, string>
  robot_id?: number | null
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
}

export interface ImportValidationError {
  row: number
  column?: string
  message: string
  severity: 'error' | 'warning'
}

export interface ImportValidateResponse {
  valid: boolean
  mapping: Record<string, string>
  row_count: number
}

export interface ImportConfirmResponse {
  message: string
  object_params: ProjectParams
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
  }[]
  routes: { id: string; name?: string; points: { x: number; y: number }[] }[]
  robots: {
    id: string
    name: string
    route_id: string
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
  routes?: { id: string; name?: string; points: { x: number; y: number }[] }[]
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
  meta?: { robots_count?: number; object_kind?: string; [key: string]: unknown }
}

export interface CalculationSummary {
  robot_count: number
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

export interface AnalyticsSummary {
  robots_total: number
  robots_by_type: { type: string; count: number }[]
  projects_total: number
  demo_projects: number
  calculations_total: number
  matching_by_status: Record<string, number>
  manufacturers_total: number
  industries_total: number
  object_types_total: number
  avg_robot_price_rub?: number | null
  recent_actions: number
  /** legacy aliases used by older UI */
  projects_active?: number
  catalog_size?: number
  selections_total?: number
  top_robots?: { name: string; count: number }[]
  projects_by_type?: { type: string; label: string; count: number }[]
  monthly_activity?: { month: string; projects: number; selections: number }[]
}

export interface ApiErrorBody {
  detail?:
    | string
    | {
        msg: string
        loc?: (string | number)[]
        type?: string
      }[]
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
