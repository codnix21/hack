import { apiClient } from './client'
import { toId } from './ids'
import type {
  Project,
  ProjectCreatePayload,
  ProjectParams,
  ProjectParamsResponse,
  WarehouseLayout,
} from '../types'

export const projectsApi = {
  list: (params?: { include_archived?: boolean }) =>
    apiClient.get<Project[]>('/projects', { params }).then((r) => r.data),

  get: (id: string | number) =>
    apiClient.get<Project>(`/projects/${toId(id)}`).then((r) => r.data),

  create: (payload: ProjectCreatePayload) =>
    apiClient.post<Project>('/projects', payload).then((r) => r.data),

  update: (id: string | number, payload: Partial<ProjectCreatePayload> & { status?: string }) =>
    apiClient.patch<Project>(`/projects/${toId(id)}`, payload).then((r) => r.data),

  remove: (id: string | number) =>
    apiClient.delete(`/projects/${toId(id)}`).then((r) => r.data),

  copy: (id: string | number) =>
    apiClient.post<Project>(`/projects/${toId(id)}/copy`).then((r) => r.data),

  archive: (id: string | number) =>
    apiClient.post<Project>(`/projects/${toId(id)}/archive`).then((r) => r.data),

  getParams: (id: string | number) =>
    apiClient.get<ProjectParamsResponse>(`/projects/${toId(id)}/params`).then((r) => r.data),

  saveParams: (id: string | number, object_params: ProjectParams) =>
    apiClient
      .put<Project>(`/projects/${toId(id)}/params`, { object_params })
      .then((r) => r.data),

  getLayout: (id: string | number) =>
    apiClient.get<WarehouseLayout>(`/projects/${toId(id)}/layout`).then((r) => r.data),

  saveLayout: (id: string | number, layout: WarehouseLayout) =>
    apiClient.put<Project>(`/projects/${toId(id)}/layout`, { layout }).then((r) => r.data),

  dxfPreview: (id: string | number, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return apiClient
      .post(`/projects/${toId(id)}/layout/dxf/preview`, fd)
      .then((r) => r.data)
  },

  dxfConfirm: (
    id: string | number,
    body: {
      preview: Record<string, unknown>
      unit_to_m?: number
      selected_ids?: string[]
      entity_kinds?: Record<string, string>
    },
  ) =>
    apiClient
      .post<Project>(`/projects/${toId(id)}/layout/dxf/confirm`, body)
      .then((r) => r.data),

  publish: (id: string | number) =>
    apiClient.post<Project>(`/projects/${toId(id)}/publish`).then((r) => r.data),

  unpublish: (id: string | number) =>
    apiClient.delete<Project>(`/projects/${toId(id)}/publish`).then((r) => r.data),

  inputsReadiness: (id: string | number) =>
    apiClient
      .get<Record<string, unknown>>(`/projects/${toId(id)}/inputs-readiness`)
      .then((r) => r.data),

  exportPdf: (id: string | number) =>
    apiClient
      .get(`/export/${toId(id)}/pdf`, { responseType: 'blob' })
      .then((r) => r.data as Blob),

  exportExcel: (id: string | number) =>
    apiClient
      .get(`/export/${toId(id)}/excel`, { responseType: 'blob' })
      .then((r) => r.data as Blob),
}

export const demoApi = {
  list: () => apiClient.get<Project[]>('/demo/projects').then((r) => r.data),

  get: (id: string | number) =>
    apiClient.get<Project>(`/demo/projects/${toId(id)}`).then((r) => r.data),

  clone: (id: string | number) =>
    apiClient.post<Project>(`/demo/projects/${toId(id)}/clone`).then((r) => r.data),
}
