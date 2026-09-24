import { create } from 'zustand'
import { authApi } from '../api/auth'
import { getFriendlyError } from '../api/client'
import type { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  isGuest: boolean
  isLoading: boolean
  error: string | null
  hydrated: boolean
  hydrate: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, fullName: string) => Promise<void>
  continueAsGuest: () => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

function persistSession(token: string, user: User, guest: boolean) {
  localStorage.setItem('access_token', token)
  localStorage.setItem('auth_user', JSON.stringify(user))
  if (guest) localStorage.setItem('guest_mode', '1')
  else localStorage.removeItem('guest_mode')
}

function clearSession() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('auth_user')
  localStorage.removeItem('guest_mode')
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isGuest: false,
  isLoading: false,
  error: null,
  hydrated: false,

  hydrate: async () => {
    const token = localStorage.getItem('access_token')
    const guest = localStorage.getItem('guest_mode') === '1'
    const cached = localStorage.getItem('auth_user')
    if (!token) {
      set({ hydrated: true, user: null, token: null, isGuest: false })
      return
    }
    if (cached) {
      try {
        set({ user: JSON.parse(cached) as User, token, isGuest: guest })
      } catch {
        /* ignore */
      }
    }
    try {
      const user = await authApi.me()
      localStorage.setItem('auth_user', JSON.stringify(user))
      set({ user, token, isGuest: guest || user.role === 'guest', hydrated: true })
    } catch {
      if (guest && cached) {
        set({ hydrated: true, isGuest: true })
      } else {
        clearSession()
        set({ user: null, token: null, isGuest: false, hydrated: true })
      }
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const data = await authApi.login(email, password)
      persistSession(data.access_token, data.user, false)
      set({
        user: data.user,
        token: data.access_token,
        isGuest: false,
        isLoading: false,
      })
    } catch (e) {
      set({ isLoading: false, error: getFriendlyError(e) })
      throw e
    }
  },

  register: async (email, password, fullName) => {
    set({ isLoading: true, error: null })
    try {
      const data = await authApi.register({ email, password, full_name: fullName })
      persistSession(data.access_token, data.user, false)
      set({
        user: data.user,
        token: data.access_token,
        isGuest: false,
        isLoading: false,
      })
    } catch (e) {
      set({ isLoading: false, error: getFriendlyError(e) })
      throw e
    }
  },

  continueAsGuest: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await authApi.guest()
      persistSession(data.access_token, data.user, true)
      set({
        user: data.user,
        token: data.access_token,
        isGuest: true,
        isLoading: false,
      })
    } catch (e) {
      set({ isLoading: false, error: getFriendlyError(e) })
      throw e
    }
  },

  logout: async () => {
    try {
      await authApi.logout()
    } finally {
      clearSession()
      set({ user: null, token: null, isGuest: false, error: null })
    }
  },

  clearError: () => set({ error: null }),
}))
