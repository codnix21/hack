import { catalogApi } from './catalog'

export const compareApi = {
  get: (ids: Array<string | number>) => catalogApi.compare(ids),
}
