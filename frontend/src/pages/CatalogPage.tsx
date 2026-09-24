import { useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Filter, Search } from 'lucide-react'
import { catalogApi } from '../api/catalog'
import { getFriendlyError } from '../api/client'
import { PageHeader } from '../components/layout/PageHeader'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { SkeletonCards } from '../components/ui/Skeleton'
import { Pagination } from '../components/ui/Pagination'
import { formatCurrency, formatKg } from '../utils/format'
import { confirmationLevelLabel, catalogTypeLabel, dataOriginLabel } from '../utils/labels'

export function CatalogPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

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

  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string }[] = []
    if (search) chips.push({ key: 'search', label: `Поиск: ${search}` })
    if (dataOrigin)
      chips.push({
        key: 'data_origin',
        label: dataOrigin === 'source' ? 'Исходные материалы' : 'Демонстрационные',
      })
    if (manufacturerId)
      chips.push({
        key: 'manufacturer_id',
        label: `Компания: ${manufacturerMap.get(Number(manufacturerId)) || manufacturerId}`,
      })
    if (solutionTypeId)
      chips.push({
        key: 'solution_type_id',
        label: `Тип: ${solutionMap.get(Number(solutionTypeId)) || solutionTypeId}`,
      })
    if (catalogTypeRaw)
      chips.push({ key: 'catalog_type_raw', label: `Тип каталога: ${catalogTypeLabel(catalogTypeRaw)}` })
    if (subtypeRaw) chips.push({ key: 'subtype_raw', label: `Подтип: ${catalogTypeLabel(subtypeRaw)}` })
    if (industryRaw) chips.push({ key: 'industry_raw', label: `Отрасль: ${industryRaw}` })
    if (regionRaw) chips.push({ key: 'region_raw', label: `Регион: ${regionRaw}` })
    if (scenarioRaw) chips.push({ key: 'scenario_raw', label: `Сценарий: ${scenarioRaw}` })
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
    manufacturerId,
    solutionTypeId,
    catalogTypeRaw,
    subtypeRaw,
    industryRaw,
    regionRaw,
    scenarioRaw,
    minPrice,
    maxPrice,
    confirmationLevel,
    manufacturerMap,
    solutionMap,
  ])

  const clearActiveFilter = (key: string) => {
    if (key === 'price') patchParams({ min_price: '', max_price: '' }, true)
    else patchParams({ [key]: '' }, true)
  }

  const toOptions = (values?: string[]) =>
    (values || []).map((v) => ({ value: v, label: catalogTypeLabel(v) }))

  return (
    <div>
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            Каталог решений
            <Badge
              variant={sourceCount > 0 ? 'success' : 'warning'}
              title={
                sourceCount > 0
                  ? 'Данные получены из исходных материалов проекта'
                  : 'Демонстрационные данные используются для показа возможностей платформы'
              }
            >
              {sourceCount > 0 ? 'Исходные материалы' : 'Демонстрационные данные'}
            </Badge>
          </span>
        }
        subtitle={
          statsQuery.isLoading
            ? 'Загрузка статистики каталога…'
            : `${sourceCount} из исходных материалов · ${demoCount} демонстрационных · всего ${sourceCount + demoCount}. Найдено по фильтрам: ${total}.`
        }
        crumbs={[
          { label: 'Панель управления', to: '/app' },
          { label: 'Каталог решений' },
        ]}
      />

      <div className="mb-5 grid gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-400" />
          <Input
            className="pl-9"
            placeholder="Поиск по названию, компании, сценарию…"
            value={search}
            onChange={(e) => patchParams({ search: e.target.value }, true)}
            aria-label="Поиск по названию, компании, сценарию"
          />
        </div>
        <Select
          placeholder="Все (происхождение)"
          value={dataOrigin}
          onChange={(e) => patchParams({ data_origin: e.target.value }, true)}
          options={[
            { value: 'source', label: 'Исходные материалы' },
            { value: 'demo', label: 'Демонстрационные' },
          ]}
        />
        <SearchableSelect
          placeholder="Фильтр: производитель"
          value={manufacturerId}
          onChange={(v) => patchParams({ manufacturer_id: v }, true)}
          options={(filtersQuery.data?.manufacturers || []).map((m) => ({
            value: m.id,
            label: m.name,
          }))}
          searchPlaceholder="Найти производителя…"
          aria-label="Производитель"
        />
        <SearchableSelect
          placeholder="Фильтр: тип решения"
          value={solutionTypeId}
          onChange={(v) => patchParams({ solution_type_id: v }, true)}
          options={(filtersQuery.data?.solution_types || []).map((t) => ({
            value: t.id,
            label: t.name_ru,
          }))}
          searchPlaceholder="Найти тип решения…"
          aria-label="Тип решения"
        />
        <SearchableSelect
          placeholder="Тип (каталог)"
          value={catalogTypeRaw}
          onChange={(v) => patchParams({ catalog_type_raw: v }, true)}
          options={toOptions(filtersQuery.data?.catalog_type_raw)}
          searchPlaceholder="Поиск типа…"
          aria-label="Тип каталога"
        />
        <SearchableSelect
          placeholder="Подтип"
          value={subtypeRaw}
          onChange={(v) => patchParams({ subtype_raw: v }, true)}
          options={toOptions(filtersQuery.data?.subtype_raw)}
          searchPlaceholder="Поиск подтипа…"
          aria-label="Подтип"
        />
        <SearchableSelect
          placeholder="Отрасль"
          value={industryRaw}
          onChange={(v) => patchParams({ industry_raw: v }, true)}
          options={toOptions(filtersQuery.data?.industry_raw)}
          searchPlaceholder="Поиск отрасли…"
          aria-label="Отрасль"
        />
        <SearchableSelect
          placeholder="Регион"
          value={regionRaw}
          onChange={(v) => patchParams({ region_raw: v }, true)}
          options={toOptions(filtersQuery.data?.region_raw)}
          searchPlaceholder="Поиск региона…"
          aria-label="Регион"
        />
        <SearchableSelect
          placeholder="Сценарий"
          value={scenarioRaw}
          onChange={(v) => patchParams({ scenario_raw: v }, true)}
          options={toOptions(filtersQuery.data?.scenario_raw)}
          searchPlaceholder="Поиск сценария…"
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
            { value: 'payload_kg:desc', label: 'Грузоподъёмность ↓' },
          ]}
        />
      </div>

      {activeFilters.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-steel-600">Активные фильтры:</span>
          {activeFilters.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-steel-200 bg-white px-2.5 py-1 text-xs text-steel-700 hover:border-steel-400"
              onClick={() => clearActiveFilter(chip.key)}
              aria-label={`Сбросить фильтр: ${chip.label}`}
            >
              {chip.label}
              <span aria-hidden>×</span>
            </button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchParams({}, { replace: true })}
          >
            Сбросить фильтры
          </Button>
          <span className="text-sm text-steel-500">Найдено: {total}</span>
        </div>
      )}

      {listQuery.isLoading && <SkeletonCards count={6} />}
      {listQuery.isError && (
        <div className="page-surface p-6 text-sm text-red-600">
          {getFriendlyError(listQuery.error)}
        </div>
      )}
      {!listQuery.isLoading && !listQuery.isError && items.length === 0 && (
        <div className="page-surface">
          <EmptyState
            title="По заданным параметрам решения не найдены"
            description="Измените поиск или фильтры и повторите попытку."
            actionLabel="Сбросить фильтры"
            onAction={() => setSearchParams({}, { replace: true })}
            icon={<Filter className="h-7 w-7" />}
          />
        </div>
      )}

      {items.length > 0 && (
        <div className="page-surface overflow-hidden">
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((r) => (
              <article
                key={r.id}
                className="border border-steel-200 border-l-[3px] border-l-steel-300 p-4 transition hover:border-l-brand-500 hover:bg-steel-50/70"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-display font-semibold text-steel-900">{r.name}</h3>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="info">
                      {(r.solution_type_id != null && solutionMap.get(r.solution_type_id)) ||
                        confirmationLevelLabel(r.confirmation_level)}
                    </Badge>
                    <Badge
                      variant={r.data_origin === 'source' ? 'success' : 'warning'}
                      title={
                        r.data_origin === 'source'
                          ? 'Данные получены из исходных материалов проекта'
                          : 'Демонстрационные данные используются для показа возможностей платформы'
                      }
                    >
                      {dataOriginLabel(r.data_origin)}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-steel-500">
                  {(r.manufacturer_id != null && manufacturerMap.get(r.manufacturer_id)) ||
                    'Производитель не указан'}
                </p>
                <dl className="mt-3 space-y-1 text-sm text-steel-700">
                  <div className="flex justify-between">
                    <dt>Грузоподъёмность</dt>
                    <dd>{formatKg(r.payload_kg)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Цена</dt>
                    <dd>{formatCurrency(r.price_rub)}</dd>
                  </div>
                  {r.data_confidence && (
                    <div className="flex justify-between gap-2">
                      <dt>Достоверность</dt>
                      <dd className="text-right text-xs text-steel-500">{r.data_confidence}</dd>
                    </div>
                  )}
                </dl>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <Button size="sm" onClick={() => navigate(`/app/catalog/${r.id}`)}>
                    Открыть карточку
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      let existing: string[] = []
                      try {
                        existing = JSON.parse(sessionStorage.getItem('compare_ids') || '[]')
                      } catch {
                        existing = []
                      }
                      if (!Array.isArray(existing)) existing = []
                      const merged = Array.from(
                        new Set([...existing.map(String), String(r.id)]),
                      ).slice(0, 6)
                      sessionStorage.setItem('compare_ids', JSON.stringify(merged))
                      navigate(`/app/compare?ids=${merged.join(',')}`)
                    }}
                  >
                    К сравнению
                  </Button>
                </div>
              </article>
            ))}
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            pageSizeOptions={[10, 20, 50]}
            onPageChange={(p) => patchParams({ page: p })}
            onPageSizeChange={(s) => patchParams({ page_size: s }, true)}
          />
        </div>
      )}
    </div>
  )
}
