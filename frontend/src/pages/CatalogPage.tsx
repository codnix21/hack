import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Filter, Search } from 'lucide-react'
import { catalogApi } from '../api/catalog'
import { getFriendlyError } from '../api/client'
import { PageHeader } from '../components/layout/PageHeader'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { SkeletonRows } from '../components/ui/Skeleton'
import { Pagination } from '../components/ui/Pagination'
import { formatCurrency, formatKg } from '../utils/format'
import { confirmationLevelLabel, catalogTypeLabel, dataOriginLabel } from '../utils/labels'

export function CatalogPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [moreOpen, setMoreOpen] = useState(false)

  const search = searchParams.get('search') || ''
  const manufacturerId = searchParams.get('manufacturer_id') || ''
  const solutionTypeId = searchParams.get('solution_type_id') || ''
  const minPayload = searchParams.get('min_payload') || ''
  const maxPayload = searchParams.get('max_payload') || ''
  const minPrice = searchParams.get('min_price') || ''
  const maxPrice = searchParams.get('max_price') || ''
  const confirmationLevel = searchParams.get('confirmation_level') || ''
  const dataOrigin = searchParams.get('data_origin') || ''
  const catalogTypeRaw = searchParams.get('catalog_type_raw') || ''
  const subtypeRaw = searchParams.get('subtype_raw') || ''
  const industryRaw = searchParams.get('industry_raw') || ''
  const regionRaw = searchParams.get('region_raw') || ''
  const scenarioRaw = searchParams.get('scenario_raw') || ''
  const sortBy = searchParams.get('sort_by') || 'name'
  const sortDir = (searchParams.get('sort_dir') as 'asc' | 'desc') || 'asc'
  const page = Math.max(1, Number(searchParams.get('page') || 1))
  const pageSize = Math.max(1, Number(searchParams.get('page_size') || 10))

  const patchParams = useCallback(
    (patch: Record<string, string | number | undefined | null>, resetPage = false) => {
      const next = new URLSearchParams(searchParams)
      Object.entries(patch).forEach(([k, v]) => {
        if (v === undefined || v === null || v === '') next.delete(k)
        else next.set(k, String(v))
      })
      if (resetPage) next.set('page', '1')
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const filtersQuery = useQuery({
    queryKey: ['catalog-filters'],
    queryFn: () => catalogApi.filters(),
  })

  const statsQuery = useQuery({
    queryKey: ['catalog-stats'],
    queryFn: () => catalogApi.stats(),
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

  const listQuery = useQuery({
    queryKey: [
      'catalog',
      search,
      manufacturerId,
      solutionTypeId,
      minPayload,
      maxPayload,
      minPrice,
      maxPrice,
      confirmationLevel,
      dataOrigin,
      catalogTypeRaw,
      subtypeRaw,
      industryRaw,
      regionRaw,
      scenarioRaw,
      sortBy,
      sortDir,
      page,
      pageSize,
    ],
    queryFn: () =>
      catalogApi.list({
        search: search || undefined,
        manufacturer_id: manufacturerId ? Number(manufacturerId) : undefined,
        solution_type_id: solutionTypeId ? Number(solutionTypeId) : undefined,
        min_payload: minPayload !== '' ? Number(minPayload) : undefined,
        max_payload: maxPayload !== '' ? Number(maxPayload) : undefined,
        min_price: minPrice !== '' ? Number(minPrice) : undefined,
        max_price: maxPrice !== '' ? Number(maxPrice) : undefined,
        confirmation_level: confirmationLevel || undefined,
        data_origin: dataOrigin || undefined,
        catalog_type_raw: catalogTypeRaw || undefined,
        subtype_raw: subtypeRaw || undefined,
        industry_raw: industryRaw || undefined,
        region_raw: regionRaw || undefined,
        scenario_raw: scenarioRaw || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
        page,
        page_size: pageSize,
      }),
  })

  const items = listQuery.data?.items ?? []
  const total = listQuery.data?.total ?? 0
  const sourceCount = statsQuery.data?.source_count ?? 0
  const demoCount = statsQuery.data?.demo_count ?? 0

  const advancedCount = useMemo(() => {
    let n = 0
    if (manufacturerId) n++
    if (catalogTypeRaw) n++
    if (subtypeRaw) n++
    if (industryRaw) n++
    if (regionRaw) n++
    if (scenarioRaw) n++
    if (minPayload || maxPayload) n++
    if (minPrice || maxPrice) n++
    if (confirmationLevel) n++
    return n
  }, [
    manufacturerId,
    catalogTypeRaw,
    subtypeRaw,
    industryRaw,
    regionRaw,
    scenarioRaw,
    minPayload,
    maxPayload,
    minPrice,
    maxPrice,
    confirmationLevel,
  ])

  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string }[] = []
    if (search) chips.push({ key: 'search', label: `Поиск: ${search}` })
    if (dataOrigin)
      chips.push({
        key: 'data_origin',
        label: dataOrigin === 'source' ? 'Исходные материалы' : 'Демонстрационные',
      })
    if (solutionTypeId)
      chips.push({
        key: 'solution_type_id',
        label: `Тип: ${solutionMap.get(Number(solutionTypeId)) || solutionTypeId}`,
      })
    if (manufacturerId)
      chips.push({
        key: 'manufacturer_id',
        label: `Компания: ${manufacturerMap.get(Number(manufacturerId)) || manufacturerId}`,
      })
    if (catalogTypeRaw)
      chips.push({ key: 'catalog_type_raw', label: `Тип каталога: ${catalogTypeLabel(catalogTypeRaw)}` })
    if (subtypeRaw) chips.push({ key: 'subtype_raw', label: `Подтип: ${catalogTypeLabel(subtypeRaw)}` })
    if (industryRaw) chips.push({ key: 'industry_raw', label: `Отрасль: ${industryRaw}` })
    if (regionRaw) chips.push({ key: 'region_raw', label: `Регион: ${regionRaw}` })
    if (scenarioRaw) chips.push({ key: 'scenario_raw', label: `Сценарий: ${scenarioRaw}` })
    if (minPayload || maxPayload)
      chips.push({
        key: 'payload',
        label: `Груз: ${minPayload || '…'}–${maxPayload || '…'} кг`,
      })
    if (minPrice || maxPrice)
      chips.push({
        key: 'price',
        label: `Цена: ${minPrice || '…'}–${maxPrice || '…'} ₽`,
      })
    if (confirmationLevel)
      chips.push({
        key: 'confirmation_level',
        label: confirmationLevelLabel(confirmationLevel),
      })
    return chips
  }, [
    search,
    dataOrigin,
    solutionTypeId,
    manufacturerId,
    catalogTypeRaw,
    subtypeRaw,
    industryRaw,
    regionRaw,
    scenarioRaw,
    minPayload,
    maxPayload,
    minPrice,
    maxPrice,
    confirmationLevel,
    manufacturerMap,
    solutionMap,
  ])

  const clearActiveFilter = (key: string) => {
    if (key === 'price') patchParams({ min_price: '', max_price: '' }, true)
    else if (key === 'payload') patchParams({ min_payload: '', max_payload: '' }, true)
    else patchParams({ [key]: '' }, true)
  }

  const toOptions = (values?: string[]) =>
    (values || []).map((v) => ({ value: v, label: catalogTypeLabel(v) }))

  const addToCompare = (id: number) => {
    let existing: string[] = []
    try {
      existing = JSON.parse(sessionStorage.getItem('compare_ids') || '[]')
    } catch {
      existing = []
    }
    if (!Array.isArray(existing)) existing = []
    const merged = Array.from(new Set([...existing.map(String), String(id)])).slice(0, 6)
    sessionStorage.setItem('compare_ids', JSON.stringify(merged))
    navigate(`/app/compare?ids=${merged.join(',')}`)
  }

  return (
    <div>
      <PageHeader
        title="Каталог решений"
        subtitle={`${total} по фильтрам · ${sourceCount} исходных · ${demoCount} демо`}
        crumbs={[
          { label: 'Обзор', to: '/app' },
          { label: 'Каталог решений' },
        ]}
        actions={
          activeFilters.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setSearchParams({}, { replace: true })}>
              Сбросить фильтры
            </Button>
          ) : null
        }
      />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="relative min-w-0 flex-1 basis-40 sm:basis-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-400" />
          <Input
            className="pl-8"
            placeholder="Поиск…"
            value={search}
            onChange={(e) => patchParams({ search: e.target.value }, true)}
            aria-label="Поиск по названию, компании, сценарию"
          />
        </div>
        <div className="hidden w-44 md:block">
          <Select
            placeholder="Происхождение"
            value={dataOrigin}
            onChange={(e) => patchParams({ data_origin: e.target.value }, true)}
            options={[
              { value: 'source', label: 'Исходные материалы' },
              { value: 'demo', label: 'Демонстрационные' },
            ]}
          />
        </div>
        <div className="hidden w-48 md:block">
          <SearchableSelect
            placeholder="Тип решения"
            value={solutionTypeId}
            onChange={(v) => patchParams({ solution_type_id: v }, true)}
            options={(filtersQuery.data?.solution_types || []).map((t) => ({
              value: t.id,
              label: t.name_ru,
            }))}
            searchPlaceholder="Найти тип…"
            aria-label="Тип решения"
          />
        </div>
        <div className="hidden w-40 lg:block">
          <Select
            value={`${sortBy}:${sortDir}`}
            onChange={(e) => {
              const [s, d] = e.target.value.split(':')
              patchParams({ sort_by: s, sort_dir: d })
            }}
            options={[
              { value: 'name:asc', label: 'Название ↑' },
              { value: 'name:desc', label: 'Название ↓' },
              { value: 'price_rub:asc', label: 'Цена ↑' },
              { value: 'price_rub:desc', label: 'Цена ↓' },
              { value: 'payload_kg:desc', label: 'Груз ↓' },
            ]}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
        >
          <Filter className="h-4 w-4" />
          Фильтры
          {advancedCount > 0 || dataOrigin || solutionTypeId
            ? ` (${
                advancedCount +
                (dataOrigin ? 1 : 0) +
                (solutionTypeId ? 1 : 0)
              })`
            : ''}
          <ChevronDown className={`h-3.5 w-3.5 transition ${moreOpen ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {moreOpen && (
        <div className="nc-panel mb-3 grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="md:hidden">
            <Select
              placeholder="Происхождение"
              value={dataOrigin}
              onChange={(e) => patchParams({ data_origin: e.target.value }, true)}
              options={[
                { value: 'source', label: 'Исходные материалы' },
                { value: 'demo', label: 'Демонстрационные' },
              ]}
            />
          </div>
          <div className="md:hidden">
            <SearchableSelect
              placeholder="Тип решения"
              value={solutionTypeId}
              onChange={(v) => patchParams({ solution_type_id: v }, true)}
              options={(filtersQuery.data?.solution_types || []).map((t) => ({
                value: t.id,
                label: t.name_ru,
              }))}
              searchPlaceholder="Найти тип…"
              aria-label="Тип решения"
            />
          </div>
          <div className="lg:hidden">
            <Select
              value={`${sortBy}:${sortDir}`}
              onChange={(e) => {
                const [s, d] = e.target.value.split(':')
                patchParams({ sort_by: s, sort_dir: d })
              }}
              options={[
                { value: 'name:asc', label: 'Название ↑' },
                { value: 'name:desc', label: 'Название ↓' },
                { value: 'price_rub:asc', label: 'Цена ↑' },
                { value: 'price_rub:desc', label: 'Цена ↓' },
                { value: 'payload_kg:desc', label: 'Груз ↓' },
              ]}
            />
          </div>
          <SearchableSelect
            placeholder="Производитель"
            value={manufacturerId}
            onChange={(v) => patchParams({ manufacturer_id: v }, true)}
            options={(filtersQuery.data?.manufacturers || []).map((m) => ({
              value: m.id,
              label: m.name,
            }))}
            searchPlaceholder="Найти…"
            aria-label="Производитель"
          />
          <SearchableSelect
            placeholder="Тип (каталог)"
            value={catalogTypeRaw}
            onChange={(v) => patchParams({ catalog_type_raw: v }, true)}
            options={toOptions(filtersQuery.data?.catalog_type_raw)}
            searchPlaceholder="Поиск…"
            aria-label="Тип каталога"
          />
          <SearchableSelect
            placeholder="Подтип"
            value={subtypeRaw}
            onChange={(v) => patchParams({ subtype_raw: v }, true)}
            options={toOptions(filtersQuery.data?.subtype_raw)}
            searchPlaceholder="Поиск…"
            aria-label="Подтип"
          />
          <SearchableSelect
            placeholder="Отрасль"
            value={industryRaw}
            onChange={(v) => patchParams({ industry_raw: v }, true)}
            options={toOptions(filtersQuery.data?.industry_raw)}
            searchPlaceholder="Поиск…"
            aria-label="Отрасль"
          />
          <SearchableSelect
            placeholder="Регион"
            value={regionRaw}
            onChange={(v) => patchParams({ region_raw: v }, true)}
            options={toOptions(filtersQuery.data?.region_raw)}
            searchPlaceholder="Поиск…"
            aria-label="Регион"
          />
          <SearchableSelect
            placeholder="Сценарий"
            value={scenarioRaw}
            onChange={(v) => patchParams({ scenario_raw: v }, true)}
            options={toOptions(filtersQuery.data?.scenario_raw)}
            searchPlaceholder="Поиск…"
            aria-label="Сценарий"
          />
          <Input
            type="number"
            placeholder="Мин. грузоподъёмность"
            value={minPayload}
            onChange={(e) => patchParams({ min_payload: e.target.value }, true)}
            aria-label="Минимальная грузоподъёмность"
          />
          <Input
            type="number"
            placeholder="Макс. грузоподъёмность"
            value={maxPayload}
            onChange={(e) => patchParams({ max_payload: e.target.value }, true)}
            aria-label="Максимальная грузоподъёмность"
          />
          <Input
            type="number"
            placeholder="Цена от, ₽"
            value={minPrice}
            onChange={(e) => patchParams({ min_price: e.target.value }, true)}
            aria-label="Минимальная цена"
          />
          <Input
            type="number"
            placeholder="Цена до, ₽"
            value={maxPrice}
            onChange={(e) => patchParams({ max_price: e.target.value }, true)}
            aria-label="Максимальная цена"
          />
          <Select
            placeholder="Уровень подтверждения"
            value={confirmationLevel}
            onChange={(e) => patchParams({ confirmation_level: e.target.value }, true)}
            options={[
              { value: 'confirmed', label: 'Подтверждено' },
              { value: 'needs_review', label: 'Требует проверки' },
              { value: 'assumption', label: 'Допущение' },
            ]}
          />
        </div>
      )}

      {activeFilters.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {activeFilters.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="nc-focusable inline-flex items-center gap-1 rounded border border-steel-200 bg-white px-2 py-0.5 text-xs text-steel-700 hover:border-steel-400"
              onClick={() => clearActiveFilter(chip.key)}
              aria-label={`Сбросить фильтр: ${chip.label}`}
            >
              {chip.label}
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}

      {listQuery.isLoading && <SkeletonRows rows={8} />}
      {listQuery.isError && (
        <div className="page-surface p-4 text-sm text-red-600">{getFriendlyError(listQuery.error)}</div>
      )}
      {!listQuery.isLoading && !listQuery.isError && items.length === 0 && (
        <div className="page-surface">
          <EmptyState
            title="Решения не найдены"
            description="Измените поиск или фильтры."
            actionLabel="Сбросить фильтры"
            onAction={() => setSearchParams({}, { replace: true })}
            icon={<Filter className="h-6 w-6" />}
          />
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="page-surface hidden overflow-x-auto md:block">
            <table className="nc-table min-w-full">
              <thead className="border-b border-steel-200 bg-steel-50/80">
                <tr>
                  <th>Решение</th>
                  <th>Производитель</th>
                  <th>Тип</th>
                  <th>Груз</th>
                  <th>Цена</th>
                  <th>Данные</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((r) => {
                  const incomplete =
                    r.confirmation_level === 'needs_review' ||
                    r.payload_kg == null ||
                    r.price_rub == null
                  return (
                    <tr key={r.id} className="hover:bg-steel-50/80">
                      <td className="max-w-[14rem]">
                        <button
                          type="button"
                          className="nc-focusable text-left font-medium text-brand-800 hover:underline"
                          title={r.name}
                          aria-label={`Открыть карточку: ${r.name}`}
                          onClick={() => navigate(`/app/catalog/${r.id}`)}
                        >
                          <span className="line-clamp-2 break-words">{r.name}</span>
                        </button>
                        {incomplete && (
                          <p className="mt-0.5 text-[11px] text-amber-800">Неполные ТТХ</p>
                        )}
                      </td>
                      <td
                        className="max-w-[9rem] truncate text-steel-600"
                        title={
                          (r.manufacturer_id != null && manufacturerMap.get(r.manufacturer_id)) ||
                          'Не указано'
                        }
                      >
                        {(r.manufacturer_id != null && manufacturerMap.get(r.manufacturer_id)) ||
                          'Не указано'}
                      </td>
                      <td
                        className="max-w-[8rem] truncate text-steel-600"
                        title={
                          (r.solution_type_id != null && solutionMap.get(r.solution_type_id)) ||
                          undefined
                        }
                      >
                        {(r.solution_type_id != null && solutionMap.get(r.solution_type_id)) || '—'}
                      </td>
                      <td className="whitespace-nowrap tabular-nums">
                        {r.payload_kg != null ? formatKg(r.payload_kg) : 'Нет данных'}
                      </td>
                      <td className="whitespace-nowrap tabular-nums">
                        {r.price_rub != null ? formatCurrency(r.price_rub) : 'Нет данных'}
                      </td>
                      <td>
                        <Badge variant={r.data_origin === 'source' ? 'success' : 'warning'}>
                          {dataOriginLabel(r.data_origin)}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Открыть карточку: ${r.name}`}
                            title={r.name}
                            onClick={() => navigate(`/app/catalog/${r.id}`)}
                          >
                            Карточка
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={`Добавить к сравнению: ${r.name}`}
                            onClick={() => addToCompare(r.id)}
                          >
                            Сравнить
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {items.map((r) => (
              <li key={r.id} className="nc-panel p-3">
                <button
                  type="button"
                  className="text-left text-sm font-semibold text-ink"
                  onClick={() => navigate(`/app/catalog/${r.id}`)}
                >
                  {r.name}
                </button>
                <p className="mt-0.5 text-xs text-steel-500">
                  {(r.manufacturer_id != null && manufacturerMap.get(r.manufacturer_id)) ||
                    'Производитель не указан'}
                  {' · '}
                  {r.payload_kg != null ? formatKg(r.payload_kg) : 'груз н/д'}
                  {' · '}
                  {r.price_rub != null ? formatCurrency(r.price_rub) : 'цена н/д'}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant={r.data_origin === 'source' ? 'success' : 'warning'}>
                    {dataOriginLabel(r.data_origin)}
                  </Badge>
                  <Button size="sm" onClick={() => navigate(`/app/catalog/${r.id}`)}>
                    Открыть
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => addToCompare(r.id)}>
                    К сравнению
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              pageSizeOptions={[10, 20, 50]}
              onPageChange={(p) => patchParams({ page: p })}
              onPageSizeChange={(s) => patchParams({ page_size: s }, true)}
            />
          </div>
        </>
      )}
    </div>
  )
}
