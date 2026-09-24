import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { GitCompare, FolderPlus } from 'lucide-react'
import { catalogApi } from '../api/catalog'
import { getFriendlyError } from '../api/client'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { SkeletonRows } from '../components/ui/Skeleton'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { projectsApi } from '../api/projects'
import { toastSuccess } from '../store/toastStore'
import {
  formatCurrency,
  formatDate,
  formatHours,
  formatKg,
  formatMps,
  formatNumber,
} from '../utils/format'
import {
  acquisitionModelLabel,
  availabilityStatusLabel,
  catalogTypeLabel,
  confirmationLevelLabel,
  dataOriginLabel,
  dataOriginTooltip,
  objectParamLabel,
} from '../utils/labels'

const NO_SOURCE_DATA = 'Нет данных в исходных материалах'

function asText(value: unknown): string {
  if (value == null || value === '') return NO_SOURCE_DATA
  if (typeof value === 'string') return value || NO_SOURCE_DATA
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return NO_SOURCE_DATA
    return value
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') {
          const o = item as Record<string, unknown>
          return String(o.title || o.name || o.result || JSON.stringify(item))
        }
        return String(item)
      })
      .join('; ')
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return NO_SOURCE_DATA
    return entries
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join('; ')
  }
  return String(value)
}

function ttxOrMissing(value: string | number | null | undefined, formatted?: string): string {
  if (value === null || value === undefined || value === '') return NO_SOURCE_DATA
  return formatted ?? String(value)
}

function getDocxEnrichment(raw: unknown): {
  fields?: Record<string, string>
  source_file?: string
  urls?: string[]
  matched_snippet?: string
  name_hint?: string
} | null {
  if (!raw || typeof raw !== 'object') return null
  const enr = (raw as Record<string, unknown>).docx_enrichment
  if (!enr || typeof enr !== 'object') return null
  return enr as {
    fields?: Record<string, string>
    source_file?: string
    urls?: string[]
    matched_snippet?: string
    name_hint?: string
  }
}

export function RobotDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [projectModal, setProjectModal] = useState(false)
  const [projectId, setProjectId] = useState('')

  const robotQuery = useQuery({
    queryKey: ['robot', id],
    queryFn: () => catalogApi.get(id),
    enabled: !!id,
  })

  const filtersQuery = useQuery({
    queryKey: ['catalog-filters'],
    queryFn: () => catalogApi.filters(),
  })

  const projectsQuery = useQuery({
    queryKey: ['projects-lite'],
    queryFn: () => projectsApi.list(),
    enabled: projectModal,
  })

  const manufacturerName = useMemo(() => {
    const mid = robotQuery.data?.manufacturer_id
    if (mid == null) return null
    return filtersQuery.data?.manufacturers.find((m) => m.id === mid)?.name
  }, [robotQuery.data, filtersQuery.data])

  const solutionName = useMemo(() => {
    const sid = robotQuery.data?.solution_type_id
    if (sid == null) return null
    return filtersQuery.data?.solution_types.find((s) => s.id === sid)?.name_ru
  }, [robotQuery.data, filtersQuery.data])

  const compareIds = useMemo(() => {
    return (params.get('compare') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }, [params])

  if (robotQuery.isLoading) return <SkeletonRows rows={10} />
  if (robotQuery.isError) {
    return <p className="text-sm text-red-600">{getFriendlyError(robotQuery.error)}</p>
  }

  const r = robotQuery.data!
  const docx = getDocxEnrichment(r.raw_data)

  const dims =
    r.length_mm != null || r.width_mm != null || r.height_mm != null
      ? `${r.length_mm ?? '—'} × ${r.width_mm ?? '—'} × ${r.height_mm ?? '—'} мм`
      : NO_SOURCE_DATA

  const blocks: { title: string; rows: { label: string; value: string }[] }[] = [
    {
      title: 'Общие сведения',
      rows: [
        { label: 'Производитель', value: manufacturerName || NO_SOURCE_DATA },
        { label: 'Тип решения', value: solutionName || NO_SOURCE_DATA },
        { label: 'Назначение', value: r.purpose || NO_SOURCE_DATA },
        { label: 'Страна', value: r.country || NO_SOURCE_DATA },
        { label: 'Доступность', value: availabilityStatusLabel(r.availability_status) },
        { label: 'Статус данных', value: confirmationLevelLabel(r.confirmation_level) },
        { label: 'Происхождение', value: dataOriginLabel(r.data_origin) },
        { label: 'Достоверность', value: r.data_confidence || NO_SOURCE_DATA },
      ],
    },
    {
      title: 'Поля каталога (исходные материалы)',
      rows: [
        { label: 'Тип (каталог)', value: r.catalog_type_raw ? catalogTypeLabel(r.catalog_type_raw) : NO_SOURCE_DATA },
        { label: 'Подтип', value: r.subtype_raw ? catalogTypeLabel(r.subtype_raw) : NO_SOURCE_DATA },
        { label: 'Отрасль', value: r.industry_raw || NO_SOURCE_DATA },
        { label: 'Регион', value: r.region_raw || NO_SOURCE_DATA },
        { label: 'Сценарий', value: r.scenario_raw || NO_SOURCE_DATA },
        { label: 'Кейсы (текст)', value: r.cases_text || NO_SOURCE_DATA },
        {
          label: 'Уровень готовности (TRL)',
          value: r.trl_level != null ? String(r.trl_level) : NO_SOURCE_DATA,
        },
        {
          label: 'Рыночный потенциал',
          value:
            r.market_potential != null
              ? formatNumber(r.market_potential, 2)
              : NO_SOURCE_DATA,
        },
        { label: 'Внешний ID', value: r.external_id || NO_SOURCE_DATA },
      ],
    },
    {
      title: 'Технические характеристики',
      rows: [
        { label: 'Грузоподъёмность', value: ttxOrMissing(r.payload_kg, formatKg(r.payload_kg)) },
        { label: 'Скорость', value: ttxOrMissing(r.speed_mps, formatMps(r.speed_mps)) },
        {
          label: 'Автономность',
          value: ttxOrMissing(r.autonomy_hours, formatHours(r.autonomy_hours)),
        },
        {
          label: 'Производительность',
          value: ttxOrMissing(
            r.productivity_ops_per_hour,
            r.productivity_ops_per_hour != null
              ? `${formatNumber(r.productivity_ops_per_hour, 0)} оп/ч`
              : undefined,
          ),
        },
        {
          label: 'Точность позиционирования',
          value: ttxOrMissing(
            r.positioning_accuracy_mm,
            r.positioning_accuracy_mm != null
              ? `${formatNumber(r.positioning_accuracy_mm, 1)} мм`
              : undefined,
          ),
        },
        {
          label: 'Ширина',
          value: ttxOrMissing(
            r.width_mm,
            r.width_mm != null ? `${formatNumber(r.width_mm, 0)} мм` : undefined,
          ),
        },
        { label: 'Габариты', value: dims },
        { label: 'Навигация', value: r.navigation || NO_SOURCE_DATA },
      ],
    },
    {
      title: 'Навигация и условия',
      rows: [{ label: 'Условия эксплуатации', value: asText(r.operating_conditions) }],
    },
    {
      title: 'Экономика',
      rows: [
        { label: 'Цена покупки', value: ttxOrMissing(r.price_rub, formatCurrency(r.price_rub)) },
        {
          label: 'ПО',
          value: ttxOrMissing(r.software_cost_rub, formatCurrency(r.software_cost_rub)),
        },
        {
          label: 'Внедрение',
          value: ttxOrMissing(r.implementation_cost_rub, formatCurrency(r.implementation_cost_rub)),
        },
        {
          label: 'Обслуживание / год',
          value: ttxOrMissing(
            r.maintenance_cost_year_rub,
            formatCurrency(r.maintenance_cost_year_rub),
          ),
        },
        {
          label: 'Срок службы',
          value: ttxOrMissing(
            r.service_life_years,
            r.service_life_years != null
              ? `${formatNumber(r.service_life_years, 0)} лет`
              : undefined,
          ),
        },
        { label: 'Модель приобретения', value: acquisitionModelLabel(r.acquisition_model) },
      ],
    },
    {
      title: 'Требования к инфраструктуре',
      rows: [{ label: 'Требования', value: asText(r.infrastructure_requirements) }],
    },
    {
      title: 'Применимость',
      rows: [{ label: 'Поддерживаемые процессы', value: asText(r.supported_processes) }],
    },
    {
      title: 'Ограничения',
      rows: [{ label: 'Ограничения', value: asText(r.limitations) }],
    },
    {
      title: 'Кейсы',
      rows: [{ label: 'Примеры внедрения', value: asText(r.cases) }],
    },
    {
      title: 'Происхождение данных',
      rows: [
        { label: 'Файл источника', value: r.source_file || NO_SOURCE_DATA },
        { label: 'Лист источника', value: r.source_sheet || NO_SOURCE_DATA },
        {
          label: 'Строка источника',
          value: r.source_row != null ? String(r.source_row) : NO_SOURCE_DATA,
        },
        { label: 'Колонка источника', value: r.source_column || NO_SOURCE_DATA },
        {
          label: 'Дата источника',
          value: r.source_date ? formatDate(r.source_date) : NO_SOURCE_DATA,
        },
        { label: 'Статус источника', value: r.source_status || NO_SOURCE_DATA },
        { label: 'Источник', value: r.source || NO_SOURCE_DATA },
        { label: 'Ссылка на источник', value: r.source_url || NO_SOURCE_DATA },
        { label: 'Происхождение данных', value: dataOriginLabel(r.data_origin) },
      ],
    },
    {
      title: 'Дата актуализации',
      rows: [{ label: 'Обновлено', value: formatDate(r.updated_at) }],
    },
  ]

  if (docx) {
    const fieldRows = Object.entries(docx.fields || {}).map(([k, v]) => ({
      label: objectParamLabel(k),
      value: String(v),
    }))
    blocks.splice(blocks.length - 1, 0, {
      title: 'Дополнительно из Примеры_решений_типы_объектов.docx',
      rows: [
        { label: 'Файл', value: docx.source_file || 'Примеры_решений_типы_объектов.docx' },
        { label: 'Совпадение', value: docx.name_hint || NO_SOURCE_DATA },
        ...(fieldRows.length
          ? fieldRows
          : [{ label: 'ТТХ', value: NO_SOURCE_DATA }]),
        {
          label: 'Ссылка',
          value: docx.urls?.length ? docx.urls.join('; ') : NO_SOURCE_DATA,
        },
        {
          label: 'Фрагмент',
          value: docx.matched_snippet || NO_SOURCE_DATA,
        },
      ],
    })
  }

  return (
    <div>
      <PageHeader
        title={r.name}
        subtitle={r.purpose || 'Карточка технического задания по решению'}
        crumbs={[
          { label: 'Панель управления', to: '/app' },
          { label: 'Каталог решений', to: '/app/catalog' },
          { label: r.name },
        ]}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                let stored: string[] = []
                try {
                  stored = JSON.parse(sessionStorage.getItem('compare_ids') || '[]')
                } catch {
                  stored = []
                }
                if (!Array.isArray(stored)) stored = []
                const ids = Array.from(
                  new Set([...stored.map(String), ...compareIds, String(r.id)]),
                ).slice(0, 6)
                sessionStorage.setItem('compare_ids', JSON.stringify(ids))
                navigate(`/app/compare?ids=${ids.join(',')}`)
                toastSuccess('Добавлено к сравнению')
              }}
            >
              <GitCompare className="h-4 w-4" />
              Добавить к сравнению
            </Button>
            <Button onClick={() => setProjectModal(true)}>
              <FolderPlus className="h-4 w-4" />
              Использовать в проекте
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {manufacturerName && <Badge variant="info">{manufacturerName}</Badge>}
        {solutionName && <Badge>{solutionName}</Badge>}
        <Badge variant="warning">{confirmationLevelLabel(r.confirmation_level)}</Badge>
        <Badge
          variant={r.data_origin === 'source' ? 'success' : 'warning'}
          title={dataOriginTooltip(r.data_origin)}
        >
          {dataOriginLabel(r.data_origin)}
        </Badge>
        {r.data_confidence && <Badge variant="info">{r.data_confidence}</Badge>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {blocks.map((b) => (
          <Card key={b.title} title={b.title}>
            <dl className="space-y-2 text-sm">
              {b.rows.map((row) => (
                <div key={row.label} className="flex justify-between gap-4 border-b border-steel-100 py-1.5">
                  <dt className="text-steel-500">{row.label}</dt>
                  <dd className="text-right font-medium text-steel-800 break-words">{row.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ))}
      </div>

      <Modal
        open={projectModal}
        onClose={() => setProjectModal(false)}
        title="Использовать в проекте"
        footer={
          <>
            <Button variant="outline" onClick={() => setProjectModal(false)}>
              Отмена
            </Button>
            <Button
              disabled={!projectId}
              onClick={() => {
                setProjectModal(false)
                navigate(`/app/projects/${projectId}?step=selection`)
                toastSuccess('Переход к проекту выполнен')
              }}
            >
              Продолжить
            </Button>
          </>
        }
      >
        {projectsQuery.isLoading && <SkeletonRows rows={3} />}
        {projectsQuery.isError && (
          <p className="text-sm text-red-600">{getFriendlyError(projectsQuery.error)}</p>
        )}
        {projectsQuery.data && (
          <Select
            label="Проект"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="Выберите проект"
            options={projectsQuery.data.map((p) => ({ value: p.id, label: p.name }))}
          />
        )}
        <p className="mt-3 text-sm text-steel-500">
          Нет нужного проекта?{' '}
          <Link to="/app/projects/new" className="text-brand-700 hover:underline">
            Создать проект
          </Link>
        </p>
      </Modal>
    </div>
  )
}
