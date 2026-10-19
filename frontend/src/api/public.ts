import { apiClient } from './client'
import type { Project } from '../types'

export interface PublicProjectView {
  project: {
    name: string
    description?: string | null
    region?: string | null
    work_mode?: string | null
    object_params?: Record<string, unknown>
    area_m2?: number | null
    published_at?: string | null
  }
  layout: unknown
  geometry: unknown
  economics: Record<string, unknown> | null
  selected_robots: {
    name: string
    match_score?: number | null
    status?: string
    selected?: boolean
    payload_kg?: number | null
    price_rub?: number | null
  }[]
  fleet_scenarios?: { code: string; name_ru: string; params?: unknown; results?: unknown }[]
  read_only: boolean
  disclaimer?: string
}

export const publicApi = {
  get: (token: string) =>
    apiClient.get<PublicProjectView>(`/public/p/${encodeURIComponent(token)}`).then((r) => r.data),

  clone: (token: string) =>
    apiClient.post<Project>(`/public/p/${encodeURIComponent(token)}/clone`).then((r) => r.data),
}
