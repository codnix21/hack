import { apiClient } from './client'
import { toId } from './ids'
import type { Project, ProjectCreatePayload, ProjectParams, ProjectParamsResponse } from '../types'

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
