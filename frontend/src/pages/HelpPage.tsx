import { Link } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { Callout } from '../components/ui/Callout'

const TERMS = [
  {
    t: 'AMR / AGV',
    d: 'Автономный мобильный робот и транспорт с направляющими. В каталоге — решения разных классов; подбор опирается на заполненные ТТХ.',
  },
  {
    t: 'Инвестиции / эксплуатация / совокупная стоимость',
    d: 'Капитальные затраты, операционные расходы и совокупная стоимость владения за горизонт. Единицы и период указаны рядом с суммами.',
  },
  {
    t: 'Актуальность расчёта',
    d: '«Актуален» — соответствует текущим параметрам. «Устарел» — параметры менялись после расчёта; экспорт отчёта недоступен до пересчёта.',
  },
  {
    t: 'DES',
    d: 'Дискретно-событийная симуляция на плане. Не телеметрия склада и не цифровой двойник.',
  },
  {
    t: 'Аренда',
    d: 'Модель «роботы как услуга»: в сравнении сценариев учитывается подписка вместо полной покупки.',
  },
]

const STAGES = [
  {
    id: 'object',
    title: 'Данные',
    need: 'Тип объекта, пиковая нагрузка, численность и ФОТ, цена решения (или из каталога).',
    assume: 'Пик из суточного объёма — расчётная оценка, если нет прямого замера.',
    limit: 'Без минимума полей подбор и экономика недоступны.',
  },
  {
    id: 'matching',
    title: 'Подбор',
    need: 'Заполненные данные объекта; в каталоге — релевантные ТТХ.',
    assume: 'Исключения по типу объекта/процессу помечаются явно.',
    limit: 'Отсутствующие характеристики не подставляются нулями.',
  },
  {
    id: 'compare',
    title: 'Сравнение',
    need: 'Выбор кандидатов и сценариев «без роботизации / покупка / аренда».',
    assume: 'Допущения «что если» влияют на пересчёт внутри проекта.',
    limit: 'Глобальное сравнение каталога не подменяет сравнение в проекте.',
  },
  {
    id: 'layout',
    title: 'План',
    need: 'Зоны и маршруты в метрах; при импорте — DXF (не DWG).',
    assume: 'Геометрия редактора — инженерный чертёж, не BIM.',
    limit: 'Планировка не блокирует экономику, но нужна для осмысленного DES.',
  },
  {
    id: 'economics',
    title: 'Экономика',
    need: 'Параметры объекта и выбранное решение; актуальный расчёт для экспорта.',
    assume: 'Доля снижения труда и горизонт — сценарные допущения.',
    limit: 'Устаревший результат нельзя принять за актуальный; фиктивные суммы не показываются.',
  },
  {
    id: 'des',
    title: 'DES',
    need: 'План с зонами; число роботов согласовано с экономикой, где возможно.',
    assume: 'Симуляция с упрощёнными показателями.',
    limit: 'Не цифровой двойник; расхождение числа роботов помечается явно.',
  },
  {
    id: 'report',
    title: 'Отчёт',
    need: 'Актуальный экономический расчёт.',
    assume: 'PDF и Excel отражают сохранённый снимок расчёта.',
    limit: 'При устаревшем расчёте экспорт блокируется до пересчёта.',
  },
]

export function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="База знаний"
        subtitle="Требования к данным, допущения и ограничения по этапам проекта"
        crumbs={[
          { label: 'Обзор', to: '/app' },
          { label: 'База знаний' },
        ]}
      />

      <div className="page-surface space-y-4 p-5">
        <h2 className="font-display text-base font-semibold text-[var(--nc-ink)]">Что делает платформа</h2>
        <p className="text-sm leading-relaxed text-[var(--nc-text)]">
          NETCORE — предынвестиционная оценка роботизации: каталог, подбор, экономика, план в
          метрах и симуляция DES. Не замена обследования площадки и КП поставщика.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/app/projects/new"
            className="nc-focusable inline-flex h-8 items-center justify-center rounded bg-brand-600 px-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Создать проект
          </Link>
          <Link
            to="/app/demo"
            className="nc-focusable inline-flex h-8 items-center justify-center rounded border border-[var(--nc-border-strong)] bg-[var(--nc-surface)] px-2.5 text-sm font-medium text-[var(--nc-ink)] hover:bg-[var(--nc-surface-hover)]"
          >
            Открыть примеры
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-base font-semibold text-[var(--nc-ink)]">Этапы проекта</h2>
        {STAGES.map((s) => (
          <div key={s.id} className="page-surface space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-[var(--nc-ink)]">{s.title}</h3>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--nc-muted)]">
                step={s.id}
              </span>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--nc-muted)]">
                  Нужно
                </dt>
                <dd className="mt-0.5 text-[var(--nc-text)]">{s.need}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--nc-muted)]">
                  Допущения
                </dt>
                <dd className="mt-0.5 text-[var(--nc-text)]">{s.assume}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--nc-muted)]">
                  Ограничения
                </dt>
                <dd className="mt-0.5 text-[var(--nc-text)]">{s.limit}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <div className="page-surface p-5">
        <h2 className="font-display text-base font-semibold text-[var(--nc-ink)]">Термины</h2>
        <dl className="mt-3 space-y-3">
          {TERMS.map((item) => (
            <div key={item.t} className="border-b border-[var(--nc-border-subtle)] pb-3 last:border-0 last:pb-0">
              <dt className="font-display text-sm font-semibold text-[var(--nc-ink)]">{item.t}</dt>
              <dd className="mt-1 text-sm text-[var(--nc-muted)]">{item.d}</dd>
            </div>
          ))}
        </dl>
      </div>

      <Callout variant="warning" title="Общие ограничения">
        <ul className="list-disc space-y-1 pl-4 text-sm">
          <li>Доля снижения труда — сценарное допущение, не отраслевая статистика.</li>
          <li>DES — симуляция, не цифровой двойник.</li>
          <li>Цены и ТТХ без данных каталога не выдумываются.</li>
          <li>DXF поддерживается; DWG — нет. Координаты плана — в метрах.</li>
        </ul>
      </Callout>
    </div>
  )
}
