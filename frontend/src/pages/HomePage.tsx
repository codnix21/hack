import { Link } from 'react-router-dom'
import { ArrowRight, Library, PlayCircle, Plus } from 'lucide-react'

const steps = [
  { n: '01', title: 'Параметры', text: 'Объект, Excel или CSV' },
  { n: '02', title: 'Подбор', text: 'Модели и статусы пригодности' },
  { n: '03', title: 'Экономика', text: 'CAPEX, OPEX, ROI, TCO' },
  { n: '04', title: 'Схема', text: '2D-маршрут на объекте' },
]

export function HomePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <section className="relative overflow-hidden rounded border border-steel-200 bg-ink text-white shadow-lift">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          aria-hidden
          style={{
            backgroundImage:
              'linear-gradient(90deg, transparent 0, transparent 48px, rgba(240,115,22,0.12) 48px, rgba(240,115,22,0.12) 49px), linear-gradient(0deg, transparent 0, transparent 48px, rgba(255,255,255,0.04) 48px, rgba(255,255,255,0.04) 49px)',
            backgroundSize: '96px 96px',
            backgroundPosition: '12px 8px',
          }}
        />
        <div
          className="pointer-events-none absolute -right-8 bottom-0 top-0 w-[46%] max-w-md opacity-90"
          aria-hidden
        >
          <svg viewBox="0 0 320 280" className="h-full w-full" fill="none">
            <rect x="24" y="36" width="272" height="208" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
            <rect x="48" y="60" width="52" height="160" fill="rgba(240,115,22,0.15)" stroke="rgba(240,115,22,0.45)" />
            <rect x="120" y="60" width="52" height="160" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.18)" />
            <rect x="192" y="60" width="52" height="160" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.18)" />
            <path
              d="M74 220 L74 100 L146 100 L146 180 L218 180 L218 80"
              stroke="#f07316"
              strokeWidth="2"
              strokeDasharray="6 5"
              className="animate-fade-in"
            />
            <circle cx="74" cy="220" r="5" fill="#f07316" />
            <circle cx="218" cy="80" r="5" fill="#f07316" />
            <text x="48" y="250" fill="rgba(255,255,255,0.35)" fontSize="11" fontFamily="IBM Plex Mono, monospace">
              СКЛАД · ЗОНЫ С1–С3
            </text>
          </svg>
        </div>

        <div className="relative px-7 py-12 md:px-10 md:py-16">
          <p className="animate-rise-in font-display text-5xl font-bold uppercase leading-none tracking-wide text-brand-400 md:text-6xl">
            РобоПодбор
          </p>
          <div className="mt-4 h-0.5 w-16 origin-left animate-draw-line bg-brand-500 delay-1" />
          <h1 className="animate-rise-in delay-1 mt-5 max-w-xl font-display text-2xl font-semibold uppercase leading-tight tracking-wide text-white md:text-3xl">
            Подбор роботизированных решений
          </h1>
          <p className="animate-rise-in delay-2 mt-3 max-w-lg text-base text-steel-300">
            Сравните модели, посчитайте экономический эффект и посмотрите работу на схеме объекта.
          </p>
          <div className="animate-rise-in delay-3 mt-8 flex flex-wrap gap-3">
            <Link
              to="/app/projects/new"
              className="inline-flex h-11 items-center gap-2 rounded bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-500"
            >
              <Plus className="h-4 w-4" />
              Создать проект
            </Link>
            <Link
              to="/app/demo"
              className="inline-flex h-11 items-center gap-2 rounded border border-white/25 bg-transparent px-5 text-sm font-medium text-white transition hover:border-white/50 hover:bg-white/5"
            >
              <PlayCircle className="h-4 w-4" />
              Демонстрация
            </Link>
            <Link
              to="/app/catalog"
              className="inline-flex h-11 items-center gap-2 px-3 text-sm font-medium text-steel-300 transition hover:text-white"
            >
              <Library className="h-4 w-4" />
              Каталог
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-ink">
            Рабочий контур
          </h2>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-steel-400">
            четыре шага
          </p>
        </div>
        <ol className="grid gap-px overflow-hidden rounded border border-steel-200 bg-steel-200 sm:grid-cols-4">
          {steps.map((s) => (
            <li key={s.n} className="bg-white p-4 transition hover:bg-brand-50/40">
              <p className="font-mono text-xs text-brand-600">{s.n}</p>
              <h3 className="mt-2 font-display text-base font-semibold uppercase tracking-wide text-ink">
                {s.title}
              </h3>
              <p className="mt-1 text-sm text-steel-500">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-6 text-xs text-steel-400">
        Каталог и демо-проекты включают демонстрационные данные для знакомства с платформой.
      </p>
    </div>
  )
}
