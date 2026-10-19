import { apiClient } from './client'
import { toId } from './ids'
import type {
  BackendLayout,
  CalculationSummary,
  EconomicsCalculateResponse,
  EconomicsRequest,
  EconomicsScenarioResult,
  FormulasResponse,
  MatchingResultsResponse,
  SensitivityResponse,
  VisualizationLayout,
  WhatIfResponse,
} from '../types'

export function normalizeLayout(raw: BackendLayout): VisualizationLayout {
  const widthM = raw.canvas?.width_m ?? 60
  const lengthM = raw.canvas?.length_m ?? 100
  const pad = 16
  const scale = Math.min((760 - pad * 2) / widthM, (480 - pad * 2) / lengthM)
  const width = Math.round(widthM * scale + pad * 2)
  const height = Math.round(lengthM * scale + pad * 2)
  const sx = (x: number) => pad + x * scale
  const sy = (y: number) => pad + y * scale
  const sw = (v: number) => v * scale
  const sh = (v: number) => v * scale

  const zones = (raw.zones || []).map((z) => ({
    id: z.id,
    name: z.name,
    x: sx(z.x),
    y: sy(z.y),
    w: sw(z.width),
    h: sh(z.height),
    color: z.color,
    type: z.type,
    rotation: Number((z as { rotation?: number }).rotation || 0),
  }))

  const routes = (raw.routes || []).map((r) => ({
    id: r.id,
    name: r.name,
    blocked: Boolean((r as { blocked?: boolean }).blocked),
    blocked_reason: (r as { blocked_reason?: string }).blocked_reason,
    length_m: Number((r as { length_m?: number }).length_m || 0),
    status: (r as { status?: string }).status,
    points: (r.points || []).map((p) => ({ x: sx(p.x), y: sy(p.y) })),
  }))

  const rawTasks = (raw as { tasks?: Array<Record<string, unknown>> }).tasks || []
  const tasks = rawTasks.map((t) => {
    const route = (t.route || {}) as {
      id?: string
      points?: { x: number; y: number }[]
      blocked?: boolean
      length_m?: number
      blocked_reason?: string
    }
    const blocked =
      Boolean(route.blocked) || String(t.status || '').toLowerCase() === 'blocked'
    const rawLen = Number(route.length_m || 0)
    const pts = blocked ? [] : route.points || []
    return {
      id: String(t.id),
      type: String(t.type || 'transfer'),
      source_id: t.source_id != null ? String(t.source_id) : undefined,
      destination_id: t.destination_id != null ? String(t.destination_id) : undefined,
      source_name: String(t.source_name || ''),
      destination_name: String(t.destination_name || ''),
      status: blocked ? 'blocked' : String(t.status || 'queued'),
      robot_id: blocked ? null : t.robot_id != null ? String(t.robot_id) : null,
      blocked_reason: t.blocked_reason != null ? String(t.blocked_reason) : route.blocked_reason,
      route_id: route.id || `route_${t.id}`,
      length_m: blocked ? 0 : rawLen,
      blocked,
      points: pts.map((p) => ({ x: sx(p.x), y: sy(p.y) })),
    }
  })

  const robots = (raw.robots || []).map((r, i) => {
    const assigned =
      r.route_id ||
      (r as { task_id?: string }).task_id ||
      (routes.length > 0 ? routes[i % routes.length]?.id : '') ||
      ''
    return {
      id: r.id,
      name: r.name || `Робот ${i + 1}`,
      route_id: assigned,
      task_id: (r as { task_id?: string }).task_id || null,
      speed: 1 + (i % 3) * 0.15,
      x: sx(r.x),
      y: sy(r.y),
    }
  })

  const charging_stations = (raw.charging_stations || []).map((p) => ({
    id: p.id,
    name: p.name,
    x: sx(p.x),
    y: sy(p.y),
    type: p.type,
  }))

  const load_unload_points = (raw.load_unload_points || []).map((p) => ({
    id: p.id,
    name: p.name,
    x: sx(p.x),
    y: sy(p.y),
    type: p.type,
  }))

  return {
    width,
    height,
    metersToPx: scale,
    walls: [
      { x1: pad / 2, y1: pad / 2, x2: width - pad / 2, y2: pad / 2 },
      { x1: width - pad / 2, y1: pad / 2, x2: width - pad / 2, y2: height - pad / 2 },
      { x1: width - pad / 2, y1: height - pad / 2, x2: pad / 2, y2: height - pad / 2 },
      { x1: pad / 2, y1: height - pad / 2, x2: pad / 2, y2: pad / 2 },
    ],
    zones,
    routes,
    tasks,
    robots,
    charging_stations,
    load_unload_points,
    robot_count: raw.meta?.robots_count ?? robots.length,
    raw,
  }
}

export interface SelectSolutionResponse {
  project_id: number
  robot_id: number
  robot_name?: string | null
  robot_price_rub?: number | null
  status?: string
  selected: boolean
  message?: string
}

export const matchingApi = {
  run: (projectId: string | number) =>
    apiClient
      .post<MatchingResultsResponse>(`/matching/${toId(projectId)}/run`)
      .then((r) => r.data),

  results: (projectId: string | number) =>
    apiClient
      .get<MatchingResultsResponse>(`/matching/${toId(projectId)}/results`)
      .then((r) => r.data),

  /** Назначить решение базой CAPEX/OPEX для проекта */
  selectForEconomics: (projectId: string | number, robotId: number) =>
    apiClient
      .post<SelectSolutionResponse>(`/matching/${toId(projectId)}/select`, {
        robot_id: robotId,
      })
      .then((r) => r.data),
}

/** Alias kept for older imports */
export const selectionApi = matchingApi

export interface FleetCompareRow {
  code: string
  name_ru: string
  robots_count: number
  economics: EconomicsScenarioResult
  operations: {
    fleet_capacity_ops_per_hour?: number
    peak_coverage?: number | null
    meets_peak_demand?: boolean
    utilization_estimate?: number | null
    idle_estimate?: number | null
    estimated?: boolean
    note?: string
    bottlenecks?: string[]
  }
  missing?: string[]
}

export interface FleetCompareResponse {
  project_id: number
  counts: number[]
  rows: FleetCompareRow[]
  insight?: string
  persisted?: boolean
  shared?: Record<string, number>
}

export interface EconomicsExplainResponse {
  steps?: { title?: string; description?: string; formula?: string; value?: unknown }[]
  formulas?: Record<string, string>
  breakdown?: Record<string, unknown>
  description?: string
  [key: string]: unknown
}

export interface EconomicsFreshnessApiResponse {
  status: 'none' | 'fresh' | 'stale'
  last_calc_at?: string | null
  mismatches?: string[]
}

export const economicsApi = {
  freshness: (projectId: string | number) =>
    apiClient
      .get<EconomicsFreshnessApiResponse>(`/economics/${toId(projectId)}/freshness`)
      .then((r) => r.data),

  calculate: (projectId: string | number, body: EconomicsRequest = {}) =>
    apiClient
      .post<EconomicsCalculateResponse>(`/economics/${toId(projectId)}/calculate`, body)
      .then((r) => r.data),

  whatIf: (
    projectId: string | number,
    body: { base: EconomicsRequest; changes: Record<string, number | string | boolean> },
  ) =>
    apiClient
      .post<WhatIfResponse>(`/economics/${toId(projectId)}/what-if`, body)
      .then((r) => r.data),

  sensitivity: (
    projectId: string | number,
    body: { base: EconomicsRequest; parameter: string; values: number[] },
  ) =>
    apiClient
      .post<SensitivityResponse>(`/economics/${toId(projectId)}/sensitivity`, body)
      .then((r) => r.data),

  formulas: () =>
    apiClient.get<FormulasResponse>('/economics/formulas').then((r) => r.data),

  fleetCompare: (
    projectId: string | number,
    body: { counts?: number[]; robot_id?: number; persist?: boolean } = {},
  ) =>
    apiClient
      .post(`/economics/${toId(projectId)}/fleet-compare`, {
        counts: body.counts || [4, 6, 8],
        robot_id: body.robot_id,
        persist: body.persist !== false,
      })
      .then((r) => r.data as FleetCompareResponse),

  /** Optional explain endpoint — returns null if unavailable */
  explain: async (
    projectId: string | number,
    body?: EconomicsRequest,
  ): Promise<EconomicsExplainResponse | null> => {
    const id = toId(projectId)
    try {
      const r = await apiClient.get<EconomicsExplainResponse>(`/economics/${id}/explain`)
      return r.data
    } catch {
      /* try POST */
    }
    try {
      const r = await apiClient.post<EconomicsExplainResponse>(`/economics/${id}/explain`, body || {})
      return r.data
    } catch {
      return null
    }
  },
}

export const visualizationApi = {
  layout: async (
    projectId: string | number,
    opts?: { robots_count?: number },
  ): Promise<VisualizationLayout> => {
    const raw = await apiClient
      .get<BackendLayout>(`/visualization/${toId(projectId)}/layout`, {
        params: opts?.robots_count != null ? { robots_count: opts.robots_count } : undefined,
      })
      .then((r) => r.data)
    return normalizeLayout(raw)
  },

  simulation: (projectId: string | number, opts?: { robots_count?: number }) =>
    apiClient
      .get(`/visualization/${toId(projectId)}/simulation`, {
        params: opts?.robots_count != null ? { robots_count: opts.robots_count } : undefined,
      })
      .then((r) => r.data),

  calculation: async (
    projectId: string | number,
    opts?: { robots_count?: number },
  ): Promise<CalculationSummary> => {
    const layout = await visualizationApi.layout(projectId, opts)
    return {
      robot_count: opts?.robots_count ?? layout.robot_count,
      config_label:
        opts?.robots_count != null
          ? `Конфигурация симуляции: ${opts.robots_count} роботов`
          : `Конфигурация из последнего расчёта: ${layout.robot_count} роботов`,
    }
  },
}
