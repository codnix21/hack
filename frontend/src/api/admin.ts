import { apiClient } from './client'
import { toId } from './ids'
import type {
  AuditLogEntry,
  DataSource,
  Manufacturer,
  Normative,
  ObjectTypeMeta,
  Robot,
  SolutionType,
  User,
} from '../types'

export const adminApi = {
  users: () => apiClient.get<User[]>('/admin/users').then((r) => r.data),

  updateUser: (
    id: string | number,
    payload: Partial<Pick<User, 'role' | 'is_active' | 'full_name'>>,
  ) => apiClient.patch<User>(`/admin/users/${toId(id)}`, payload).then((r) => r.data),

  robots: (include_archived = true) =>
    apiClient
      .get<Robot[]>('/admin/robots', { params: { include_archived } })
      .then((r) => r.data),

  createRobot: (payload: Partial<Robot> & { name: string }) =>
    apiClient.post<Robot>('/admin/robots', payload).then((r) => r.data),

  updateRobot: (id: string | number, payload: Partial<Robot>) =>
    apiClient.patch<Robot>(`/admin/robots/${toId(id)}`, payload).then((r) => r.data),

  deleteRobot: (id: string | number) =>
    apiClient.delete(`/admin/robots/${toId(id)}`).then((r) => r.data),

  manufacturers: () =>
    apiClient.get<Manufacturer[]>('/admin/manufacturers').then((r) => r.data),

  createManufacturer: (payload: { name: string; country?: string; website?: string }) =>
    apiClient.post<Manufacturer>('/admin/manufacturers', payload).then((r) => r.data),

  updateManufacturer: (
    id: string | number,
    payload: Partial<{ name: string; country: string; website: string; archived: boolean }>,
  ) =>
    apiClient
      .patch<Manufacturer>(`/admin/manufacturers/${toId(id)}`, payload)
      .then((r) => r.data),

  deleteManufacturer: (id: string | number) =>
    apiClient.delete(`/admin/manufacturers/${toId(id)}`).then((r) => r.data),

  objectTypes: () =>
    apiClient.get<ObjectTypeMeta[]>('/admin/object-types').then((r) => r.data),

  createObjectType: (payload: {
    code: string
    name_ru: string
    industry_id?: number | null
  }) => apiClient.post<ObjectTypeMeta>('/admin/object-types', payload).then((r) => r.data),

  updateObjectType: (
    id: string | number,
    payload: Partial<{ code: string; name_ru: string; industry_id: number | null }>,
  ) =>
    apiClient
      .patch<ObjectTypeMeta>(`/admin/object-types/${toId(id)}`, payload)
      .then((r) => r.data),

  deleteObjectType: (id: string | number) =>
    apiClient.delete(`/admin/object-types/${toId(id)}`).then((r) => r.data),

  solutionTypes: () =>
    apiClient.get<SolutionType[]>('/admin/solution-types').then((r) => r.data),

  createSolutionType: (payload: { code: string; name_ru: string }) =>
    apiClient.post<SolutionType>('/admin/solution-types', payload).then((r) => r.data),

  updateSolutionType: (
    id: string | number,
    payload: Partial<{ code: string; name_ru: string }>,
  ) =>
    apiClient
      .patch<SolutionType>(`/admin/solution-types/${toId(id)}`, payload)
      .then((r) => r.data),

  deleteSolutionType: (id: string | number) =>
    apiClient.delete(`/admin/solution-types/${toId(id)}`).then((r) => r.data),

  sources: () => apiClient.get<DataSource[]>('/admin/sources').then((r) => r.data),

  createSource: (payload: { name: string; url?: string; description?: string }) =>
    apiClient.post<DataSource>('/admin/sources', payload).then((r) => r.data),

  updateSource: (
    id: string | number,
    payload: Partial<{ name: string; url: string; description: string }>,
  ) => apiClient.patch<DataSource>(`/admin/sources/${toId(id)}`, payload).then((r) => r.data),

  deleteSource: (id: string | number) =>
    apiClient.delete(`/admin/sources/${toId(id)}`).then((r) => r.data),

  norms: () => apiClient.get<Normative[]>('/admin/normatives').then((r) => r.data),

  updateNorm: (
    id: string | number,
    payload: Partial<Pick<Normative, 'value' | 'name_ru' | 'unit' | 'source'>>,
  ) =>
    apiClient.patch<Normative>(`/admin/normatives/${toId(id)}`, payload).then((r) => r.data),

  assumptions: () =>
    apiClient
      .get<{ defaults: Record<string, number>; formulas: Record<string, string> }>(
        '/admin/assumptions',
      )
      .then((r) => r.data),

  auditLog: (limit = 100) =>
    apiClient.get<AuditLogEntry[]>('/admin/audit', { params: { limit } }).then((r) => r.data),
}
