import axios, { AxiosError, type AxiosInstance } from 'axios'
import type { ApiErrorBody } from '../types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const PYDANTIC_MSG_RU: Record<string, string> = {
  'Field required': 'Обязательное поле не заполнено',
  'field required': 'Обязательное поле не заполнено',
  'Input should be a valid number': 'Введите число',
  'Input should be a valid integer': 'Введите целое число',
  'Input should be a valid string': 'Введите текст',
  'value is not a valid email address': 'Некорректный адрес электронной почты',
}

function localizeValidationMsg(msg: string): string {
  if (PYDANTIC_MSG_RU[msg]) return PYDANTIC_MSG_RU[msg]
  const lower = msg.toLowerCase()
  if (lower.includes('field required')) return 'Обязательное поле не заполнено'
  if (lower.includes('valid number')) return 'Введите число'
  if (lower.includes('valid integer')) return 'Введите целое число'
  // Не пробрасываем сырой английский текст валидации — общее сообщение
  if (/^[A-Za-z]/.test(msg) && !/[А-Яа-яЁё]/.test(msg)) {
    return 'Проверьте корректность введённых данных'
  }
  return msg
}

const HTTP_STATUS_RU: Record<number, string> = {
  400: 'Некорректный запрос. Проверьте введённые данные.',
  401: 'Требуется авторизация. Войдите в систему.',
  403: 'Недостаточно прав для выполнения операции.',
  404: 'Запрошенный ресурс не найден.',
  409: 'Конфликт данных. Обновите страницу и повторите попытку.',
  413: 'Файл слишком большой для загрузки.',
  422: 'Проверьте корректность введённых данных.',
  429: 'Слишком много запросов. Подождите и повторите.',
  500: 'Внутренняя ошибка сервера. Попробуйте позже.',
  502: 'Сервис временно недоступен. Повторите позже.',
  503: 'Сервис временно недоступен. Повторите позже.',
}

function localizeDetailString(detail: string): string {
  const t = detail.trim()
  if (!t) return 'Произошла ошибка запроса.'
  // Русский текст API оставляем; английский/traceback не показываем пользователю
  if (/[А-Яа-яЁё]/.test(t) && !/Traceback|Exception|Error:/i.test(t)) return t
  if (/Traceback|Exception|at 0x/i.test(t)) {
    return 'Внутренняя ошибка сервера. Попробуйте позже.'
  }
  return localizeValidationMsg(t)
}

export function getFriendlyError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<ApiErrorBody>
    if (!ax.response) {
      return 'Не удалось связаться с сервером. Проверьте подключение и повторите попытку.'
    }
    const status = ax.response.status
    const data = ax.response.data
    if (typeof data?.detail === 'string') return localizeDetailString(data.detail)
    if (Array.isArray(data?.detail) && data.detail[0]?.msg) {
      return data.detail.map((d) => localizeValidationMsg(String(d.msg))).join('; ')
    }
    if (data?.detail && typeof data.detail === 'object' && !Array.isArray(data.detail)) {
      const d = data.detail as {
        code?: string
        message?: string
        errors?: { message?: string }[]
      }
      if (d.code === 'inputs_incomplete') {
        const parts = (d.errors || [])
          .map((e) => e.message)
          .filter((m): m is string => Boolean(m))
        if (parts.length) return parts.join('; ')
        if (typeof d.message === 'string') return localizeDetailString(d.message)
      }
      if (
        d.code === 'economics_stale' ||
        d.code === 'economics_not_calculated'
      ) {
        if (typeof d.message === 'string') return localizeDetailString(d.message)
      }
      if (typeof d.message === 'string') return localizeDetailString(d.message)
    }
    if (typeof data?.message === 'string') return localizeDetailString(data.message)
    if (HTTP_STATUS_RU[status]) return HTTP_STATUS_RU[status]
    if (status >= 500) return HTTP_STATUS_RU[500]
    return `Ошибка запроса (${status}). Обновите страницу или повторите действие.`
  }
  if (error instanceof Error && error.message) {
    return localizeDetailString(error.message)
  }
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
    if (field && !out[field]) out[field] = localizeValidationMsg(String(item.msg))
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
  // FormData: сбросить application/json, иначе multipart без boundary ломает upload (DXF и т.п.)
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (typeof config.headers.delete === 'function') {
      config.headers.delete('Content-Type')
    } else {
      delete (config.headers as Record<string, unknown>)['Content-Type']
    }
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const isAuthRoute = error.config?.url?.includes('/auth/')
      if (!isAuthRoute) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
      }
    }
    // PDF/Excel: responseType=blob — тело ошибки тоже Blob; иначе 409 выглядит как «Конфликт данных»
    if (
      axios.isAxiosError(error) &&
      error.response?.data instanceof Blob &&
      error.response.status >= 400
    ) {
      try {
        const text = await error.response.data.text()
        const parsed: unknown = JSON.parse(text)
        error.response.data = parsed as ApiErrorBody
      } catch {
        /* оставляем Blob */
      }
    }
    return Promise.reject(error)
  },
)

export { API_URL }
