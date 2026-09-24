import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueries, useQuery } from '@tanstack/react-query'
import { GitCompare, Plus, Search, X } from 'lucide-react'
import { compareApi } from '../api/compare'
import { catalogApi } from '../api/catalog'
import { getFriendlyError } from '../api/client'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { EmptyState } from '../components/ui/EmptyState'
import { SkeletonRows } from '../components/ui/Skeleton'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Pagination } from '../components/ui/Pagination'
import { formatCurrency, formatHours, formatKg, formatMps } from '../utils/format'
import {
  confirmationLevelLabel,
  dataOriginLabel,
  dataOriginTooltip,
  NO_SOURCE_DATA,
} from '../utils/labels'
import type { Robot } from '../types'
import { toastSuccess } from '../store/toastStore'

const MAX_COMPARE = 6

function parseIds(raw: string | null): string[] {
  return (raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function ComparePage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerPage, setPickerPage] = useState(1)

  const ids = useMemo(() => parseIds(params.get('ids')), [params])

  const setIds = (next: string[]) => {
    const unique = Array.from(new Set(next.map(String))).slice(0, MAX_COMPARE)
    try {
      sessionStorage.setItem('compare_ids', JSON.stringify(unique))
    } catch {
      /* ignore quota */
    }
    if (unique.length === 0) setParams({}, { replace: true })
    else setParams({ ids: unique.join(',') }, { replace: true })
  }

  const addId = (id: string | number) => {
    const sid = String(id)
    if (ids.includes(sid)) return
    if (ids.length >= MAX_COMPARE) {
      return
    }
    setIds([...ids, sid])
  }

  const removeId = (id: string | number) => {
    setIds(ids.filter((x) => x !== String(id)))
  }

  const filtersQuery = useQuery({
    queryKey: ['catalog-filters'],
    queryFn: () => catalogApi.filters(),
  })

  const manufacturerMap = useMemo(() => {
    const m = new Map<number, string>()
    ;(filtersQuery.data?.manufacturers || []).forEach((x) => m.set(x.id, x.name))
    return m
  }, [filtersQuery.data])

  const solutionMap = useMemo(() => {
    const m = new Map<number, string>()
    ;(filtersQuery.data?.solution_types || []).forEach((x) => m.set(x.id, x.name_ru))
    return m
  }, [filtersQuery.data])

  const compareQuery = useQuery({
    queryKey: ['compare', ids.join(',')],
    queryFn: () => compareApi.get(ids),
    enabled: ids.length >= 2,
  })

  const pickerQuery = useQuery({
    queryKey: ['compare-picker', pickerSearch, pickerPage],
    queryFn: () =>
      catalogApi.list({
        search: pickerSearch.trim() || undefined,
        page: pickerPage,
        page_size: 10,
        sort_by: 'name',
        sort_dir: 'asc',
      }),
    enabled: pickerOpen,
  })

  const robots = compareQuery.data?.robots || []

  const selectedDetailQueries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['robot', id],
      queryFn: () => catalogApi.get(id),
      enabled: ids.length > 0 && (ids.length < 2 || !robots.some((r) => String(r.id) === id)),
      staleTime: 60_000,
    })),
  })

  // Keep selection order from URL; fill names from compare or individual cards
  const orderedRobots = useMemo(() => {
    const byId = new Map<string, Robot>()
    robots.forEach((r) => byId.set(String(r.id), r))
    selectedDetailQueries.forEach((q) => {
      if (q.data) byId.set(String(q.data.id), q.data)
    })
    return ids.map((id) => byId.get(id)).filter((r): r is Robot => Boolean(r))
  }, [robots, ids, selectedDetailQueries])

  const chipItems = useMemo(() => {
    const byId = new Map(orderedRobots.map((r) => [String(r.id), r.name]))
    return ids.map((id) => ({
      id,
      name: byId.get(id) || 'Загрузка…',
    }))
  }, [ids, orderedRobots])

  const rows: { label: string; get: (r: Robot) => string }[] = [
    {
      label: 'Производитель',
      get: (r) =>
        (r.manufacturer_id != null && manufacturerMap.get(r.manufacturer_id)) || NO_SOURCE_DATA,
    },
    {
      label: 'Тип решения',
      get: (r) =>
        (r.solution_type_id != null && solutionMap.get(r.solution_type_id)) || NO_SOURCE_DATA,
    },
    {
      label: 'Происхождение',
      get: (r) => dataOriginLabel(r.data_origin),
    },
    { label: 'Грузоподъёмность', get: (r) => formatKg(r.payload_kg) },
    { label: 'Скорость', get: (r) => formatMps(r.speed_mps) },
    { label: 'Автономность', get: (r) => formatHours(r.autonomy_hours) },
    {
      label: 'Производительность',
      get: (r) =>
        r.productivity_ops_per_hour != null
          ? `${r.productivity_ops_per_hour} оп/ч`
          : NO_SOURCE_DATA,
    },
    { label: 'Цена', get: (r) => formatCurrency(r.price_rub) },
    {
      label: 'Обслуживание / год',
      get: (r) => formatCurrency(r.maintenance_cost_year_rub),
    },
    { label: 'Навигация', get: (r) => r.navigation || NO_SOURCE_DATA },
    {
      label: 'Уровень подтверждения',
      get: (r) => confirmationLevelLabel(r.confirmation_level),
    },
  ]

  const pickerItems = pickerQuery.data?.items || []
  const pickerTotal = pickerQuery.data?.total || 0
  const atLimit = ids.length >= MAX_COMPARE

  return (
    <div>
      <PageHeader
        title="Сравнение решений"
        subtitle="Выберите решения из каталога и сопоставьте характеристики"
        crumbs={[
          { label: 'Панель управления', to: '/app' },
          { label: 'Сравнение' },
        ]}
        actions={
          <Button
            onClick={() => {
              setPickerOpen(true)
              setPickerPage(1)
            }}
            disabled={atLimit}
            aria-label="Добавить решение к сравнению"
          >
            <Plus className="h-4 w-4" />
            Добавить решение
          </Button>
        }
      />

      <div className="mb-5 rounded border border-steel-200 bg-white p-4 shadow-panel">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel-400">
              Выбрано для сравнения
            </p>
            <p className="mt-0.5 text-sm text-steel-600">
              {ids.length} из {MAX_COMPARE} · минимум 2 решения
            </p>
          </div>
          {ids.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setIds([])}>
              Очистить
            </Button>
          )}
        </div>

        {ids.length === 0 ? (
          <p className="text-sm text-steel-500">
            Добавьте решения кнопкой выше или из карточки в каталоге («К сравнению»).
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {chipItems.map((item) => (
              <li key={item.id}>
                <span className="inline-flex items-center gap-1.5 rounded border border-steel-200 bg-steel-50 py-1 pl-2.5 pr-1 text-sm text-steel-800">
                  <Link
                    to={`/app/catalog/${item.id}`}
                    className="max-w-[220px] truncate font-medium hover:text-brand-700"
                  >
                    {item.name}
                  </Link>
                  <button
                    type="button"
                    className="rounded p-1 text-steel-400 hover:bg-white hover:text-steel-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    aria-label={`Убрать ${item.name} из сравнения`}
                    onClick={() => removeId(item.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {atLimit && (
          <p className="mt-2 text-xs text-steel-500">
            Достигнут лимит сравнения ({MAX_COMPARE}). Уберите одно решение, чтобы добавить другое.
          </p>
        )}
      </div>

      {ids.length < 2 && (
        <div className="page-surface">
          <EmptyState
            title="Недостаточно решений для сравнения"
            description="Выберите минимум два решения из каталога — по названию, без ввода идентификаторов."
            actionLabel="Выбрать из каталога"
            onAction={() => {
              setPickerOpen(true)
              setPickerPage(1)
            }}
            icon={<GitCompare className="h-7 w-7" />}
          />
        </div>
      )}

      {ids.length >= 2 && compareQuery.isLoading && <SkeletonRows rows={8} />}

      {ids.length >= 2 && compareQuery.isError && (
        <p className="text-sm text-red-600">{getFriendlyError(compareQuery.error)}</p>
      )}

      {ids.length >= 2 &&
        !compareQuery.isLoading &&
        !compareQuery.isError &&
        orderedRobots.length < 2 && (
          <div className="page-surface">
            <EmptyState
              title="Не удалось загрузить решения"
              description="Часть выбранных позиций недоступна. Уберите их и выберите другие из каталога."
              actionLabel="Выбрать из каталога"
              onAction={() => setPickerOpen(true)}
            />
          </div>
        )}

      {orderedRobots.length >= 2 && (
        <div className="page-surface overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-steel-200 bg-steel-50">
                <th className="px-4 py-3 text-left font-medium text-steel-600">Параметр</th>
                {orderedRobots.map((r) => (
                  <th key={r.id} className="min-w-[160px] px-4 py-3 text-left font-medium text-steel-800">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          to={`/app/catalog/${r.id}`}
                          className="text-brand-700 hover:underline"
                        >
                          {r.name}
                        </Link>
                        <div className="mt-1">
                          <Badge
                            variant={r.data_origin === 'source' ? 'success' : 'warning'}
                            title={dataOriginTooltip(r.data_origin)}
                          >
                            {dataOriginLabel(r.data_origin)}
                          </Badge>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded p-1 text-steel-400 hover:bg-steel-100 hover:text-steel-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        aria-label={`Убрать ${r.name}`}
                        onClick={() => removeId(r.id)}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-steel-100">
                  <td className="px-4 py-3 text-steel-500">{row.label}</td>
                  {orderedRobots.map((r) => (
                    <td key={`${row.label}-${r.id}`} className="px-4 py-3 text-steel-800">
                      {row.get(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Выбор решений"
        size="lg"
        footer={
          <Button variant="outline" onClick={() => setPickerOpen(false)}>
            Готово
          </Button>
        }
      >
        <div className="space-y-4">
          <Input
            label="Поиск по названию"
            value={pickerSearch}
            onChange={(e) => {
              setPickerSearch(e.target.value)
              setPickerPage(1)
            }}
            placeholder="Например: AMR, MiR, Geek+"
            aria-label="Поиск решений"
          />
          {pickerQuery.isLoading && <p className="text-sm text-steel-500">Загрузка каталога…</p>}
          {pickerQuery.isError && (
            <p className="text-sm text-red-600">{getFriendlyError(pickerQuery.error)}</p>
          )}
          {!pickerQuery.isLoading && !pickerQuery.isError && pickerItems.length === 0 && (
            <p className="py-6 text-center text-sm text-steel-500">
              <Search className="mx-auto mb-2 h-5 w-5 text-steel-400" />
              Ничего не найдено. Измените запрос.
            </p>
          )}
          {pickerItems.length > 0 && (
            <ul className="divide-y divide-steel-100 rounded border border-steel-200">
              {pickerItems.map((r) => {
                const selected = ids.includes(String(r.id))
                const disabled = !selected && atLimit
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-steel-900">{r.name}</p>
                      <p className="text-xs text-steel-500">
                        {(r.manufacturer_id != null && manufacturerMap.get(r.manufacturer_id)) ||
                          'Производитель не указан'}{' '}
                        · {formatKg(r.payload_kg)} · {formatCurrency(r.price_rub)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={selected ? 'outline' : 'primary'}
                      disabled={disabled}
                      onClick={() => {
                        if (selected) removeId(r.id)
                        else {
                          addId(r.id)
                          toastSuccess(`«${r.name}» добавлено к сравнению`)
                        }
                      }}
                    >
                      {selected ? 'Убрать' : 'Добавить'}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
          {pickerTotal > 10 && (
            <Pagination
              page={pickerPage}
              pageSize={10}
              total={pickerTotal}
              onPageChange={setPickerPage}
            />
          )}
          <p className="text-xs text-steel-500">
            Также можно добавить решение со страницы каталога или карточки робота.
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setPickerOpen(false)
              navigate('/app/catalog')
            }}
          >
            Открыть полный каталог
          </Button>
        </div>
      </Modal>
    </div>
  )
}
