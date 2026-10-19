import { Link } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'

const TERMS = [
  {
    t: 'Капитальные затраты (CAPEX)',
    d: 'Первоначальные вложения: оборудование, инфраструктура, ПО, внедрение и резерв. Часть статей — допущения модели, не коммерческое предложение поставщика.',
  },
  {
    t: 'Эксплуатационные расходы (OPEX)',
    d: 'Ежегодные затраты роботизации: сервис, энергия, связь, персонал сопровождения и др.',
  },
  {
    t: 'Совокупная стоимость владения (TCO)',
    d: 'CAPEX + OPEX × горизонт анализа в границах модели. Не включает оставшийся ручной труд — полный денежный выход показывается отдельно.',
  },
  {
    t: 'Чистая приведённая стоимость (NPV)',
    d: 'Дисконтированная стоимость денежных потоков при выбранной ставке (по умолчанию 12%).',
  },
  {
    t: 'Роботы как услуга (RaaS)',
    d: 'Аренда вместо покупки. ROI относительно стартового CAPEX к покупке не сопоставляется — смотрите платежи, NPV и эффект.',
  },
  {
    t: 'Что необходимо проверить',
    d: 'Характеристики робота, которых нет в каталоге. Отсутствие данных не считается преимуществом: балл ограничивается, статус — «требует проверки».',
  },
]

export function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Справка"
        subtitle="Методика, термины и границы предварительной оценки NETCORE"
        crumbs={[{ label: 'Обзор', to: '/app' }, { label: 'Справка' }]}
      />

      <Card title="Что делает платформа">
        <p className="text-sm leading-relaxed text-steel-700">
          NETCORE помогает оценить целесообразность роботизации объекта: подобрать решения из
          каталога, сравнить сценарии «без роботов / покупка / услуга», рассчитать экономику и
          посмотреть демонстрационную схему работы на плане. Это{' '}
          <strong className="font-semibold text-ink">предынвестиционная оценка</strong>, а не
          замена обследования объекта и коммерческого предложения поставщика.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-steel-700">
          <li>Создайте проект и укажите тип объекта (склад, аэропорт или медучреждение).</li>
          <li>Заполните параметры вручную или загрузите Excel; при необходимости уточните план.</li>
          <li>Запустите подбор — смотрите причины и недостающие характеристики.</li>
          <li>Сравните сценарии и измените допущения в анализе «что если».</li>
          <li>Скачайте отчёт PDF или Excel для обсуждения с руководством.</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/app/projects/new"
            className="rounded bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500"
          >
            Создать проект
          </Link>
          <Link
            to="/app/demo"
            className="rounded border border-steel-300 px-3 py-2 text-sm font-medium text-steel-800 hover:bg-steel-50"
          >
            Открыть демо
          </Link>
        </div>
      </Card>

      <Card title="Термины">
        <dl className="space-y-3">
          {TERMS.map((item) => (
            <div key={item.t} className="border-b border-steel-100 pb-3 last:border-0 last:pb-0">
              <dt className="font-display text-sm font-semibold tracking-wide text-ink">{item.t}</dt>
              <dd className="mt-1 text-sm text-steel-600">{item.d}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Ограничения">
        <ul className="list-disc space-y-2 pl-5 text-sm text-steel-700">
          <li>Доля снижения труда 40% — сценарное допущение, не отраслевая статистика.</li>
          <li>Пиковая нагрузка из суточного объёма отбора — расчётная оценка, не измерение на объекте.</li>
          <li>Симуляция — дискретно-событийная демонстрация, не цифровой двойник склада.</li>
          <li>Цены и ТТХ без данных каталога не выдумываются; неполные карточки помечаются.</li>
          <li>Поддержка DXF (не DWG). Координаты плана — в метрах.</li>
        </ul>
      </Card>
    </div>
  )
}
