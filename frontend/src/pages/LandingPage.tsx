import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Button } from '../components/ui/Button'
import { toastError, toastSuccess } from '../store/toastStore'

/** Полноэкранный фон героя: план склада с маршрутом AMR — визуальный якорь продукта. */
function HeroPlanVisual() {
  return (
    <svg
      className="landing-hero-plan absolute inset-0 h-full w-full"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="lp-floor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1c1f26" />
          <stop offset="55%" stopColor="#14171c" />
          <stop offset="100%" stopColor="#2a1a10" />
        </linearGradient>
        <linearGradient id="lp-wash" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#d45a0a" stopOpacity="0.22" />
          <stop offset="50%" stopColor="#d45a0a" stopOpacity="0" />
          <stop offset="100%" stopColor="#848da1" stopOpacity="0.12" />
        </linearGradient>
        <pattern id="lp-grid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M48 0H0V48" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="1600" height="900" fill="url(#lp-floor)" />
      <rect width="1600" height="900" fill="url(#lp-grid)" />
      <rect width="1600" height="900" fill="url(#lp-wash)" />

      {/* стеллажи */}
      {[0, 1, 2, 3, 4, 5].map((col) => (
        <g key={col} opacity="0.55">
          <rect
            x={180 + col * 180}
            y={160}
            width={72}
            height={520}
            rx="2"
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1.5"
          />
          {[0, 1, 2, 3, 4, 5, 6].map((bay) => (
            <line
              key={bay}
              x1={180 + col * 180}
              y1={200 + bay * 68}
              x2={252 + col * 180}
              y2={200 + bay * 68}
              stroke="rgba(255,255,255,0.08)"
            />
          ))}
        </g>
      ))}

      {/* контур зоны */}
      <rect
        x="120"
        y="110"
        width="1280"
        height="640"
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="2"
      />

      {/* маршрут робота */}
      <path
        className="landing-route"
        d="M220 720 L220 420 L580 420 L580 240 L1120 240 L1120 560 L1380 560"
        fill="none"
        stroke="#f07316"
        strokeWidth="3"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <circle className="landing-robot" cx="220" cy="720" r="10" fill="#fb923c" />
      <circle cx="1380" cy="560" r="8" fill="none" stroke="#fb923c" strokeWidth="2" />

      {/* подписи на плане — часть атмосферы, не оверлеи с бейджами */}
      <text x="140" y="96" fill="rgba(255,255,255,0.35)" fontSize="14" fontFamily="ui-monospace, monospace">
        ZONE A · STORAGE
      </text>
      <text x="1180" y="780" fill="rgba(255,255,255,0.28)" fontSize="13" fontFamily="ui-monospace, monospace">
        МАРШРУТ · NETCORE
      </text>
    </svg>
  )
}

export function LandingPage() {
  const navigate = useNavigate()
  const continueAsGuest = useAuthStore((s) => s.continueAsGuest)
  const [guestLoading, setGuestLoading] = useState(false)

  const startGuest = async (to: string) => {
    setGuestLoading(true)
    try {
      await continueAsGuest()
      toastSuccess('Вы продолжаете как гость')
      navigate(to)
    } catch {
      toastError(useAuthStore.getState().error || 'Не удалось войти как гость')
    } finally {
      setGuestLoading(false)
    }
  }

  return (
    <div className="landing-page min-h-screen bg-[var(--nc-surface-muted)] text-[var(--nc-ink)]">
      {/* HERO — одно полотно на первый экран */}
      <header className="relative min-h-[100svh] overflow-hidden text-white">
        <HeroPlanVisual />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/55 to-ink/25" />

        <div className="relative z-10 flex min-h-[100svh] flex-col">
          <div className="flex items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
            <span className="font-display text-sm font-bold uppercase tracking-[0.2em] text-brand-400">
              NETCORE
            </span>
            <Link
              to="/login"
              className="nc-focusable text-sm font-medium text-[var(--nc-text)] underline-offset-4 hover:text-white hover:underline"
            >
              Войти
            </Link>
          </div>

          <div className="flex flex-1 flex-col justify-end px-5 pb-14 pt-10 sm:px-8 sm:pb-20 lg:px-12 lg:pb-24">
            <p className="landing-rise font-display text-5xl font-bold uppercase leading-none tracking-wide text-brand-400 sm:text-7xl lg:text-8xl">
              NETCORE
            </p>
            <h1 className="landing-rise landing-rise-delay-1 mt-5 max-w-xl font-display text-2xl font-semibold leading-tight text-white sm:text-3xl lg:text-4xl">
              Оценка роботизации склада до закупки оборудования
            </h1>
            <p className="landing-rise landing-rise-delay-2 mt-3 max-w-md text-base leading-relaxed text-[var(--nc-faint)] sm:text-lg">
              Подбор AMR/AGV, расчёт инвестиций и эффекта, схема работы на плане объекта.
            </p>
            <div className="landing-rise landing-rise-delay-3 mt-8 flex flex-wrap gap-3">
              <Button
                size="lg"
                loading={guestLoading}
                onClick={() => void startGuest('/app/demo')}
                className="min-w-[12rem]"
              >
                Смотреть примеры
              </Button>
              <Button
                size="lg"
                variant="outlineOnDark"
                loading={guestLoading}
                onClick={() => void startGuest('/app/projects/new')}
                className="min-w-[12rem]"
              >
                Создать проект
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Одна задача: что получает клиент */}
      <section className="border-b border-[var(--nc-border)] bg-[var(--nc-surface)] px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-2xl font-semibold text-[var(--nc-ink)] sm:text-3xl">
            От цифр объекта — к решению для руководства
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[var(--nc-text)]">
            NETCORE собирает исходные данные, отбирает решения из каталога и считает экономику
            так, чтобы можно было обсуждать внедрение с фактами, а не с презентацией «из воздуха».
          </p>
        </div>
      </section>

      {/* Одна задача: путь */}
      <section className="border-b border-[var(--nc-border)] bg-[var(--nc-surface-muted)] px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-2xl font-semibold text-[var(--nc-ink)] sm:text-3xl">Как проходит оценка</h2>
          <p className="mt-2 max-w-xl text-[var(--nc-text)]">
            Четыре шага — от параметров площадки до отчёта. Без заполнения всего каталога полей.
          </p>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['01', 'Объект', 'Пик нагрузки, персонал, цена решения — минимум для расчёта'],
              ['02', 'Подбор', 'Кандидаты AMR/AGV по параметрам и ограничениям площадки'],
              ['03', 'Экономика', 'Инвестиции, эффект, окупаемость, сценарии покупки и аренды'],
              ['04', 'План и отчёт', 'Схема на плане, DES, PDF/Excel для руководства'],
            ].map(([n, t, d]) => (
              <li key={n} className="border-t border-brand-600 pt-4">
                <p className="font-mono text-xs tracking-widest text-[var(--nc-accent)]">{n}</p>
                <p className="mt-2 font-display text-lg font-semibold text-[var(--nc-ink)]">{t}</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--nc-text)]">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Одна задача: для кого */}
      <section className="border-b border-[var(--nc-border)] bg-[var(--nc-surface)] px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-end">
          <div>
            <h2 className="font-display text-2xl font-semibold text-[var(--nc-ink)] sm:text-3xl">
              Для команд, которые выбирают роботизацию
            </h2>
            <p className="mt-3 text-[var(--nc-text)]">
              Операционные директора, инженеры по автоматизации и интеграторы — когда нужно быстро
              понять масштаб инвестиций и сравнить варианты до обследования объекта.
            </p>
          </div>
          <ul className="space-y-3 text-sm text-[var(--nc-text)]">
            <li className="border-l-2 border-brand-600 pl-3">Складская логистика и fulfilment</li>
            <li className="border-l-2 border-[var(--nc-border)] pl-3">Аэропортовые и сервисные зоны</li>
            <li className="border-l-2 border-[var(--nc-border)] pl-3">Медицинская внутриобъектовая логистика</li>
          </ul>
        </div>
      </section>

      {/* Финальный CTA */}
      <section className="bg-ink px-5 py-16 text-white sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-lg">
            <p className="font-display text-3xl font-bold uppercase tracking-wide text-brand-400">
              NETCORE
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
              Откройте примеры или начните свой проект
            </h2>
            <p className="mt-2 text-[var(--nc-faint)]">
              Гостевая сессия — без регистрации. Результат предварительный и требует проверки на
              объекте.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" loading={guestLoading} onClick={() => void startGuest('/app/demo')}>
              Смотреть примеры
            </Button>
            <Link
              to="/login"
              className="nc-focusable inline-flex h-11 items-center rounded border border-white/25 px-5 text-sm font-medium text-white hover:bg-[var(--nc-surface)]/10"
            >
              Войти
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--nc-border)] bg-[var(--nc-surface-muted)] px-5 py-6 text-xs text-[var(--nc-muted)] sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
          <span className="font-display font-semibold tracking-wide text-[var(--nc-text)]">NETCORE</span>
          <span>Предынвестиционная оценка · не замена обследования объекта</span>
        </div>
      </footer>
    </div>
  )
}
