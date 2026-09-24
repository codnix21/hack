import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Tabs } from '../components/ui/Tabs'
import { ToastHost } from '../components/ui/ToastHost'
import { toastError, toastSuccess } from '../store/toastStore'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token, login, register, continueAsGuest, isLoading, error, clearError } = useAuthStore()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

  const from = (location.state as { from?: string } | null)?.from || '/app'

  if (token) return <Navigate to={from} replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    clearError()
    try {
      if (mode === 'login') {
        await login(email, password)
        toastSuccess('Вы успешно вошли в систему')
      } else {
        await register(email, password, fullName)
        toastSuccess('Регистрация выполнена')
      }
      navigate(from)
    } catch {
      toastError(useAuthStore.getState().error || 'Не удалось выполнить вход')
    }
  }

  const onGuest = async () => {
    try {
      await continueAsGuest()
      toastSuccess('Вы продолжаете как гость')
      navigate('/app')
    } catch {
      toastError(useAuthStore.getState().error || 'Не удалось войти как гость')
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="relative hidden overflow-hidden bg-ink text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          aria-hidden
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative">
          <span className="brand-mark">РП</span>
          <p className="mt-8 font-display text-5xl font-bold uppercase leading-none tracking-wide text-brand-400">
            РобоПодбор
          </p>
          <p className="mt-4 max-w-sm text-base text-steel-300">
            Промышленная платформа подбора AMR/AGV, расчёта эффекта и схемы работы на объекте.
          </p>
        </div>
        <dl className="relative grid gap-4 font-mono text-xs uppercase tracking-[0.12em] text-steel-400">
          <div className="border-l-2 border-brand-500 pl-3">
            <dt>Каталог</dt>
            <dd className="mt-1 text-steel-200">исходные и демо-модели</dd>
          </div>
          <div className="border-l-2 border-white/20 pl-3">
            <dt>Экономика</dt>
            <dd className="mt-1 text-steel-200">CAPEX · OPEX · ROI · TCO</dd>
          </div>
          <div className="border-l-2 border-white/20 pl-3">
            <dt>Визуализация</dt>
            <dd className="mt-1 text-steel-200">2D-маршруты на плане</dd>
          </div>
        </dl>
      </aside>

      <div className="flex flex-col justify-center bg-steel-50 px-6 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <span className="brand-mark">РП</span>
            <p className="mt-3 font-display text-3xl font-bold uppercase tracking-wide text-brand-600">
              РобоПодбор
            </p>
          </div>
          <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-ink">
            Вход в систему
          </h1>
          <p className="mt-2 text-sm text-steel-500">Рабочий доступ к проектам и каталогу</p>

          <div className="page-surface mt-8 p-6">
            <Tabs
              items={[
                { id: 'login', label: 'Войти' },
                { id: 'register', label: 'Регистрация' },
              ]}
              value={mode}
              onChange={(id) => {
                setMode(id as 'login' | 'register')
                clearError()
              }}
              className="mb-5"
            />

            <form className="space-y-4" onSubmit={onSubmit}>
              {mode === 'register' && (
                <Input
                  label="ФИО"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                />
              )}
              <Input
                label="Электронная почта"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <Input
                label="Пароль"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" loading={isLoading}>
                {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-steel-200" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-steel-400">или</span>
              <div className="h-px flex-1 bg-steel-200" />
            </div>

            <Button variant="outline" className="w-full" onClick={onGuest} loading={isLoading}>
              Продолжить как гость
            </Button>
          </div>

          <p className="mt-6 text-center text-sm text-steel-500">
            <Link to="/" className="text-brand-700 hover:underline">
              На главную
            </Link>
          </p>
        </div>
      </div>
      <ToastHost />
    </div>
  )
}
