import { apiClient } from './client'
import type { AuthResponse, User } from '../types'

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data),

  register: (payload: { email: string; password: string; full_name: string }) =>
    apiClient.post<AuthResponse>('/auth/register', payload).then((r) => r.data),

  guest: () => apiClient.post<AuthResponse>('/auth/guest').then((r) => r.data),

  me: () => apiClient.get<User>('/auth/me').then((r) => r.data),

  logout: () => apiClient.post('/auth/logout').then((r) => r.data).catch(() => undefined),
}
