import { apiClient } from './client'
import { toId } from './ids'
import type {
  BackendLayout,
  CalculationSummary,
  EconomicsCalculateResponse,
  EconomicsRequest,
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
  }))

  const routes = (raw.routes || []).map((r) => ({
    id: r.id,
    name: r.name,
    points: (r.points || []).map((p) => ({ x: sx(p.x), y: sy(p.y) })),
  }))

  const robots = (raw.robots || []).map((r, i) => {
    const assigned =
      r.route_id ||
      (routes.length > 0 ? routes[i % routes.length]?.id : '') ||
      ''
    return {
      id: r.id,
      name: r.name || `Робот ${i + 1}`,
      route_id: assigned,
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
    walls: [
      { x1: pad / 2, y1: pad / 2, x2: width - pad / 2, y2: pad / 2 },
      { x1: width - pad / 2, y1: pad / 2, x2: width - pad / 2, y2: height - pad / 2 },
      { x1: width - pad / 2, y1: height - pad / 2, x2: pad / 2, y2: height - pad / 2 },
      { x1: pad / 2, y1: height - pad / 2, x2: pad / 2, y2: pad / 2 },
    ],
    zones,
    routes,
    robots,
    charging_stations,
    load_unload_points,
    robot_count: raw.meta?.robots_count ?? robots.length,
    raw,
  }
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
}

/** Alias kept for older imports */
export const selectionApi = matchingApi

export interface EconomicsExplainResponse {
  steps?: { title?: string; description?: string; formula?: string; value?: unknown }[]
  formulas?: Record<string, string>
  breakdown?: Record<string, unknown>
  description?: string
  [key: string]: unknown
}

export const economicsApi = {
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
  layout: async (projectId: string | number): Promise<VisualizationLayout> => {
    const raw = await apiClient
      .get<BackendLayout>(`/visualization/${toId(projectId)}/layout`)
      .then((r) => r.data)
    return normalizeLayout(raw)
  },

  simulation: (projectId: string | number) =>
    apiClient
      .get(`/visualization/${toId(projectId)}/simulation`)
      .then((r) => r.data),

  calculation: async (projectId: string | number): Promise<CalculationSummary> => {
    const layout = await visualizationApi.layout(projectId)
    return { robot_count: layout.robot_count }
  },
}

export const analyticsApi = {
  summary: () => apiClient.get('/analytics/summary').then((r) => r.data),
}
