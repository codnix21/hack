import axios, { AxiosError, type AxiosInstance } from 'axios'
import type { ApiErrorBody } from '../types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export function getFriendlyError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<ApiErrorBody>
    if (!ax.response) {
      return 'Не удалось связаться с сервером. Проверьте подключение и повторите попытку.'
    }
    const status = ax.response.status
    const data = ax.response.data
    if (typeof data?.detail === 'string') return data.detail
    if (Array.isArray(data?.detail) && data.detail[0]?.msg) {
      return data.detail.map((d) => d.msg).join('; ')
    }
    if (data?.message) return data.message
    if (status === 401) return 'Требуется авторизация. Войдите в систему.'
    if (status === 403) return 'Недостаточно прав для выполнения операции.'
    if (status === 404) return 'Запрошенный ресурс не найден.'
    if (status === 422) return 'Проверьте корректность введённых данных.'
    if (status >= 500) return 'Внутренняя ошибка сервера. Попробуйте позже.'
    return `Ошибка запроса (${status}).`
  }
  if (error instanceof Error && error.message) return error.message
  return 'Произошла непредвиденная ошибка.'
}

/** Разбор field-level ошибок FastAPI 422 → { field: message }. */
export function getFieldErrors(error: unknown): Record<string, string> {
  if (!axios.isAxiosError(error)) return {}
  const detail = (error as AxiosError<ApiErrorBody>).response?.data?.detail
  if (!Array.isArray(detail)) return {}
  const out: Record<string, string> = {}
  for (const item of detail) {
    if (!item?.msg) continue
    const loc = item.loc || []
    const field = [...loc]
      .reverse()
      .find((part): part is string => typeof part === 'string' && part !== 'body' && part !== 'query')
    if (field && !out[field]) out[field] = item.msg
  }
  return out
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  const guest = localStorage.getItem('guest_mode') === '1'
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (guest) {
    config.headers['X-Guest-Mode'] = '1'
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const isAuthRoute = error.config?.url?.includes('/auth/')
      if (!isAuthRoute) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
      }
    }
    return Promise.reject(error)
  },
)

export { API_URL }
