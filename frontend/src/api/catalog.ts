import { apiClient } from './client'
import { toId } from './ids'
import type {
  CatalogFilters,
  CatalogMetaFilters,
  CatalogStats,
  CompareResponse,
  Industry,
  ObjectTypeMeta,
  PaginatedResponse,
  Robot,
} from '../types'

export const catalogApi = {
  list: (params?: CatalogFilters) =>
    apiClient.get<PaginatedResponse<Robot>>('/catalog', { params }).then((r) => r.data),

  get: (id: string | number) =>
    apiClient.get<Robot>(`/catalog/${toId(id)}`).then((r) => r.data),

  stats: () => apiClient.get<CatalogStats>('/catalog/stats').then((r) => r.data),

  filters: () =>
    apiClient.get<CatalogMetaFilters>('/catalog/meta/filters').then((r) => r.data),

  manufacturers: async () => (await catalogApi.filters()).manufacturers,

  solutionTypes: async () => (await catalogApi.filters()).solution_types,

  objectTypes: () =>
    apiClient.get<ObjectTypeMeta[]>('/catalog/meta/object-types').then((r) => r.data),

  industries: () =>
    apiClient.get<Industry[]>('/catalog/meta/industries').then((r) => r.data),

  compare: (ids: Array<string | number>) =>
    apiClient
      .get<CompareResponse>('/catalog/compare', {
        params: { ids: ids.map(toId).join(',') },
      })
      .then((r) => r.data),
}
