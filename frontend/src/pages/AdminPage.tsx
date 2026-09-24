import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../api/admin'
import { importApi } from '../api/import'
import { projectsApi } from '../api/projects'
import { getFriendlyError } from '../api/client'
import type {
  DictionaryItem,
  ImportBatch,
  Normative,
  ObjectTypeMeta,
  Robot,
  SolutionType,
} from '../types'
import { PageHeader } from '../components/layout/PageHeader'
import { Tabs } from '../components/ui/Tabs'
import { Card } from '../components/ui/Card'
import { Table } from '../components/ui/Table'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Pagination } from '../components/ui/Pagination'
import { EmptyState } from '../components/ui/EmptyState'
import { SkeletonRows } from '../components/ui/Skeleton'
import { Badge } from '../components/ui/Badge'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { toastError, toastSuccess } from '../store/toastStore'
import { formatDateTime } from '../utils/format'
import { assumptionLabel, importBatchStatusLabel, projectStatusLabel, auditActionLabel, formatAuditDetails, formatAuditEntity } from '../utils/labels'

const SECTIONS = [
  { id: 'users', label: 'Пользователи' },
  { id: 'projects', label: 'Проекты' },
  { id: 'catalog', label: 'Каталог' },
  { id: 'manufacturers', label: 'Производители' },
  { id: 'object-types', label: 'Типы объектов' },
  { id: 'solution-types', label: 'Типы решений' },
  { id: 'sources', label: 'Источники' },
  { id: 'norms', label: 'Нормативы' },
  { id: 'assumptions', label: 'Допущения' },
  { id: 'catalog-import', label: 'Импорт каталога' },
  { id: 'source-import', label: 'Импорт материалов' },
  { id: 'audit', label: 'Журнал изменений' },
]

export function AdminPage() {
  const [section, setSection] = useState('users')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const qc = useQueryClient()

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.users(),
    enabled: section === 'users',
  })

  const projectsQuery = useQuery({
    queryKey: ['admin-projects'],
    queryFn: () => projectsApi.list({ include_archived: true }),
    enabled: section === 'projects',
  })

  const catalogQuery = useQuery({
    queryKey: ['admin-catalog'],
    queryFn: () => adminApi.robots(true),
    enabled: section === 'catalog',
  })

  const manufacturersQuery = useQuery({
    queryKey: ['admin-manufacturers'],
    queryFn: () => adminApi.manufacturers(),
    enabled: section === 'manufacturers',
  })

  const objectTypesQuery = useQuery({
    queryKey: ['admin-object-types'],
    queryFn: () => adminApi.objectTypes(),
    enabled: section === 'object-types',
  })

  const solutionTypesQuery = useQuery({
    queryKey: ['admin-solution-types'],
    queryFn: () => adminApi.solutionTypes(),
    enabled: section === 'solution-types',
  })

  const sourcesQuery = useQuery({
    queryKey: ['admin-sources'],
    queryFn: () => adminApi.sources(),
    enabled: section === 'sources',
  })

  const normsQuery = useQuery({
    queryKey: ['admin-norms'],
    queryFn: () => adminApi.norms(),
    enabled: section === 'norms',
  })

  const assumptionsQuery = useQuery({
    queryKey: ['admin-assumptions'],
    queryFn: () => adminApi.assumptions(),
    enabled: section === 'assumptions',
  })

  const auditQuery = useQuery({
    queryKey: ['admin-audit'],
    queryFn: () => adminApi.auditLog(200),
    enabled: section === 'audit',
  })

  const [assumptionsDraft, setAssumptionsDraft] = useState<Record<string, string>>({})
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<{
    columns: string[]
    sample_rows: Record<string, string>[]
    total_rows: number
  } | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [lastImportResult, setLastImportResult] = useState<Record<string, unknown> | null>(null)
  const [batchDetail, setBatchDetail] = useState<ImportBatch | null>(null)

  useEffect(() => {
    if (assumptionsQuery.data?.defaults) {
      const next: Record<string, string> = {}
      Object.entries(assumptionsQuery.data.defaults).forEach(([k, v]) => {
        next[k] = String(v)
      })
      setAssumptionsDraft(next)
    }
  }, [assumptionsQuery.data])

  const filterBySearch = <T extends { name?: string; email?: string; name_ru?: string; code?: string }>(
    items: T[],
  ) => {
    if (!search.trim()) return items
    const q = search.trim().toLowerCase()
    return items.filter(
      (i) =>
        (i.name || '').toLowerCase().includes(q) ||
        (i.email || '').toLowerCase().includes(q) ||
        (i.name_ru || '').toLowerCase().includes(q) ||
        (i.code || '').toLowerCase().includes(q),
    )
  }

  const users = useMemo(
    () => filterBySearch(usersQuery.data || []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [usersQuery.data, search],
  )
  const projects = useMemo(
    () => filterBySearch(projectsQuery.data || []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectsQuery.data, search],
  )
  const robots = useMemo(
    () => filterBySearch(catalogQuery.data || []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalogQuery.data, search],
  )

  const paginate = <T,>(items: T[]) => {
    const total = items.length
    const slice = items.slice((page - 1) * pageSize, page * pageSize)
    return { total, slice }
  }

  const MAX_IMPORT_BYTES = 10 * 1024 * 1024

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} Б`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
  }

  const summarizeImport = (r: Record<string, unknown>, fallback: string) => {
    const parts: string[] = ['Импорт завершён']
    const rows = r.total_rows ?? r.processed ?? r.examples_found
    if (rows != null) parts.push(`Строк / записей: ${rows}`)
    if (r.added != null) parts.push(`Добавлено: ${r.added}`)
    if (r.created != null) parts.push(`Создано: ${r.created}`)
    if (r.updated != null || r.robots_updated != null)
      parts.push(`Обновлено: ${r.updated ?? r.robots_updated}`)
    if (r.robots_matched != null) parts.push(`Сопоставлено: ${r.robots_matched}`)
    if (r.skipped != null) parts.push(`Пропущено: ${r.skipped}`)
    const errCount =
      typeof r.error_count === 'number'
        ? r.error_count
        : Array.isArray(r.errors)
          ? r.errors.length
          : typeof r.errors === 'number'
            ? r.errors
            : null
    if (errCount != null) parts.push(`Ошибок: ${errCount}`)
    const warnCount =
      typeof r.warning_count === 'number'
        ? r.warning_count
        : Array.isArray(r.warnings)
          ? r.warnings.length
          : typeof r.warnings === 'number'
            ? r.warnings
            : null
    if (warnCount != null) parts.push(`Предупреждений: ${warnCount}`)
    const unmatched = r.unmatched_hints
    if (Array.isArray(unmatched) && unmatched.length)
      parts.push(`Не сопоставлено: ${unmatched.join(', ')}`)
    const sheets = r.sheets
    if (sheets && typeof sheets === 'object') {
      const names = Object.keys(sheets as Record<string, unknown>)
      if (names.length) parts.push(`Листы: ${names.join(', ')}`)
    }
    return parts.length > 1 ? parts.join('. ') : String(r.message || fallback)
  }

  const previewMut = useMutation({
    mutationFn: (f: File) => {
      if (f.size > MAX_IMPORT_BYTES) {
        throw new Error('Файл слишком большой. Максимальный размер — 10 МБ.')
      }
      return importApi.catalogPreview(f)
    },
    onSuccess: (data) => {
      setImportPreview(data)
      const m: Record<string, string> = {}
      data.columns.forEach((c) => {
        m[c] = c
      })
      setMapping(m)
      toastSuccess('Файл каталога загружен')
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const confirmImportMut = useMutation({
    mutationFn: () => {
      if (!importFile) throw new Error('Файл не выбран')
      if (importFile.size > MAX_IMPORT_BYTES) {
        throw new Error('Файл слишком большой. Максимальный размер — 10 МБ.')
      }
      return importApi.catalogConfirm(importFile, mapping)
    },
    onSuccess: (r) => {
      setLastImportResult(r as Record<string, unknown>)
      toastSuccess(summarizeImport(r as Record<string, unknown>, 'Импорт каталога завершён'))
      qc.invalidateQueries({ queryKey: ['admin-catalog'] })
      qc.invalidateQueries({ queryKey: ['admin-import-batches'] })
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const sourceCatalogMut = useMutation({
    mutationFn: () => importApi.sourceCatalog(),
    onSuccess: (r) => {
      setLastImportResult(r as Record<string, unknown>)
      toastSuccess(summarizeImport(r as Record<string, unknown>, 'Каталог материалов импортирован'))
      qc.invalidateQueries({ queryKey: ['admin-catalog'] })
      qc.invalidateQueries({ queryKey: ['admin-import-batches'] })
      qc.invalidateQueries({ queryKey: ['catalog-stats'] })
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const sourceDatasetsMut = useMutation({
    mutationFn: () => importApi.sourceDatasets(),
    onSuccess: (r) => {
      setLastImportResult(r as Record<string, unknown>)
      toastSuccess(summarizeImport(r as Record<string, unknown>, 'Датасеты импортированы'))
      qc.invalidateQueries({ queryKey: ['admin-catalog'] })
      qc.invalidateQueries({ queryKey: ['admin-import-batches'] })
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const docxExamplesMut = useMutation({
    mutationFn: () => importApi.docxExamples(),
    onSuccess: (r) => {
      setLastImportResult(r as Record<string, unknown>)
      toastSuccess(summarizeImport(r as Record<string, unknown>, 'DOCX: обогащение завершено'))
      qc.invalidateQueries({ queryKey: ['admin-catalog'] })
      qc.invalidateQueries({ queryKey: ['catalog'] })
      qc.invalidateQueries({ queryKey: ['catalog-stats'] })
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const batchesQuery = useQuery({
    queryKey: ['admin-import-batches'],
    queryFn: () => importApi.importBatches(),
    enabled: section === 'source-import',
  })

  const onSectionChange = (id: string) => {
    setSection(id)
    setPage(1)
    setSearch('')
  }

  const usersPage = paginate(users)
  const projectsPage = paginate(projects)
  const auditItems = auditQuery.data || []
  const auditPage = paginate(auditItems)
  const batchesPage = paginate(batchesQuery.data || [])

  return (
    <div>
      <PageHeader
        title="Администрирование"
        subtitle="Управление пользователями, справочниками и каталогом"
        crumbs={[
          { label: 'Панель управления', to: '/app' },
          { label: 'Администрирование' },
        ]}
      />

      <Tabs items={SECTIONS} value={section} onChange={onSectionChange} className="mb-5" />

      {['users', 'projects', 'catalog', 'audit'].includes(section) && (
        <div className="mb-4 max-w-sm">
          {section !== 'audit' && (
            <Input
              placeholder="Поиск…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              aria-label="Поиск"
            />
          )}
        </div>
      )}

      {section === 'users' && (
        <AdminTableCard
          loading={usersQuery.isLoading}
          error={usersQuery.error}
          empty={!usersPage.slice.length}
          page={page}
          pageSize={pageSize}
          total={usersPage.total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        >
          <Table
            columns={[
              { key: 'email', header: 'Электронная почта', render: (u) => u.email },
              { key: 'name', header: 'ФИО', render: (u) => u.full_name },
              {
                key: 'role',
                header: 'Роль',
                render: (u) => (
                  <Badge>
                    {u.role === 'admin'
                      ? 'Администратор'
                      : u.role === 'guest'
                        ? 'Гость'
                        : u.role === 'vendor'
                          ? 'Вендор'
                          : 'Пользователь'}
                  </Badge>
                ),
              },
              {
                key: 'active',
                header: 'Статус',
                render: (u) => (u.is_active === false ? 'Отключён' : 'Активен'),
              },
            ]}
            rows={usersPage.slice}
            rowKey={(u) => u.id}
          />
        </AdminTableCard>
      )}

      {section === 'projects' && (
        <AdminTableCard
          loading={projectsQuery.isLoading}
          error={projectsQuery.error}
          empty={!projectsPage.slice.length}
          page={page}
          pageSize={pageSize}
          total={projectsPage.total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        >
          <Table
            columns={[
              { key: 'name', header: 'Название', render: (p) => p.name },
              { key: 'owner', header: 'Владелец ID', render: (p) => p.owner_id ?? '—' },
              {
                key: 'status',
                header: 'Статус',
                render: (p) => projectStatusLabel(p.status),
              },
              {
                key: 'type',
                header: 'Тип объекта ID',
                render: (p) => p.object_type_id ?? '—',
              },
            ]}
            rows={projectsPage.slice}
            rowKey={(p) => p.id}
          />
        </AdminTableCard>
      )}

      {section === 'catalog' && (
        <CatalogAdminSection
          loading={catalogQuery.isLoading}
          error={catalogQuery.error}
          robots={robots}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onChanged={() => qc.invalidateQueries({ queryKey: ['admin-catalog'] })}
        />
      )}

      {section === 'manufacturers' && (
        <DictSection
          kind="manufacturers"
          title="Производители"
          loading={manufacturersQuery.isLoading}
          error={manufacturersQuery.error}
          items={(manufacturersQuery.data || []).map((m) => ({
            id: m.id,
            name: m.name,
            code: m.country || undefined,
          }))}
          onChanged={() => qc.invalidateQueries({ queryKey: ['admin-manufacturers'] })}
        />
      )}
      {section === 'object-types' && (
        <DictSection
          kind="object-types"
          title="Типы объектов"
          loading={objectTypesQuery.isLoading}
          error={objectTypesQuery.error}
          items={(objectTypesQuery.data || []).map(toDict)}
          needCode
          onChanged={() => qc.invalidateQueries({ queryKey: ['admin-object-types'] })}
        />
      )}
      {section === 'solution-types' && (
        <DictSection
          kind="solution-types"
          title="Типы решений"
          loading={solutionTypesQuery.isLoading}
          error={solutionTypesQuery.error}
          items={(solutionTypesQuery.data || []).map(toDict)}
          needCode
          onChanged={() => qc.invalidateQueries({ queryKey: ['admin-solution-types'] })}
        />
      )}
      {section === 'sources' && (
        <DictSection
          kind="sources"
          title="Источники"
          loading={sourcesQuery.isLoading}
          error={sourcesQuery.error}
          items={(sourcesQuery.data || []).map((s) => ({
            id: s.id,
            name: s.name,
            code: s.url || undefined,
          }))}
          onChanged={() => qc.invalidateQueries({ queryKey: ['admin-sources'] })}
        />
      )}
      {section === 'norms' && (
        <NormsSection
          loading={normsQuery.isLoading}
          error={normsQuery.error}
          items={normsQuery.data || []}
          onSave={(id, value) =>
            adminApi
              .updateNorm(id, { value })
              .then(() => {
                toastSuccess('Норматив обновлён')
                qc.invalidateQueries({ queryKey: ['admin-norms'] })
              })
              .catch((e) => toastError(getFriendlyError(e)))
          }
        />
      )}

      {section === 'assumptions' && (
        <Card title="Допущения расчётов (только просмотр)">
          {assumptionsQuery.isLoading && <SkeletonRows />}
          {assumptionsQuery.isError && (
            <p className="text-sm text-red-600">{getFriendlyError(assumptionsQuery.error)}</p>
          )}
          <p className="mb-3 text-sm text-steel-500">
            Значения по умолчанию модели. Редактирование нормативов — во вкладке «Нормативы».
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {Object.keys(assumptionsDraft).map((k) => (
              <Input key={k} label={assumptionLabel(k)} value={assumptionsDraft[k]} readOnly />
            ))}
          </div>
        </Card>
      )}

      {section === 'catalog-import' && (
        <Card title="Импорт каталога">
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => {
              const f = e.target.files?.[0] || null
              if (f && f.size > MAX_IMPORT_BYTES) {
                toastError('Файл слишком большой. Максимальный размер — 10 МБ.')
                e.target.value = ''
                setImportFile(null)
                return
              }
              setImportFile(f)
              setImportPreview(null)
            }}
          />
          {importFile && (
            <dl className="mt-3 grid gap-1 text-sm text-steel-700 sm:grid-cols-2">
              <div>
                <dt className="text-steel-500">Название файла</dt>
                <dd className="font-medium">{importFile.name}</dd>
              </div>
              <div>
                <dt className="text-steel-500">Тип</dt>
                <dd>{importFile.type || importFile.name.split('.').pop()?.toUpperCase() || '—'}</dd>
              </div>
              <div>
                <dt className="text-steel-500">Размер</dt>
                <dd>{formatFileSize(importFile.size)} (лимит 10 МБ)</dd>
              </div>
              <div>
                <dt className="text-steel-500">Дата выбора</dt>
                <dd>{formatDateTime(new Date().toISOString())}</dd>
              </div>
            </dl>
          )}
          <Button
            className="mt-3"
            disabled={!importFile}
            loading={previewMut.isPending}
            onClick={() => importFile && previewMut.mutate(importFile)}
          >
            Предпросмотр
          </Button>
          {importPreview && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-steel-600">Строк в файле: {importPreview.total_rows}</p>
              <Table
                columns={importPreview.columns.map((c) => ({
                  key: c,
                  header: c,
                  render: (row: Record<string, string>) => row[c] ?? '—',
                }))}
                rows={importPreview.sample_rows}
                rowKey={(row) => JSON.stringify(row)}
              />
              <Button
                loading={confirmImportMut.isPending}
                onClick={() => confirmImportMut.mutate()}
              >
                Подтвердить импорт
              </Button>
            </div>
          )}
          {lastImportResult && section === 'catalog-import' && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              {summarizeImport(lastImportResult, 'Импорт завершён')}
            </div>
          )}
        </Card>
      )}

      {section === 'source-import' && (
        <div className="space-y-5">
          <Card title="Импорт материалов проекта">
            <p className="mb-4 text-sm text-steel-600">
              Загрузка каталога (`catalog_export_v4.csv`), датасетов объектов
              (`Датасеты_хакатон.xlsx`) и обогащение из DOCX-примеров решений
              из каталога `data/sources` (в Docker — `/data/sources`).
              Повторный импорт обновляет записи и не удаляет уже загруженные решения
              из исходных материалов.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-steel-200 p-4">
                <h4 className="mb-1 font-medium text-steel-900">Каталог из CSV</h4>
                <p className="mb-3 text-xs text-steel-500">
                  Импорт исходного каталога → роботы и происхождение данных
                </p>
                <Button
                  loading={sourceCatalogMut.isPending}
                  onClick={() => sourceCatalogMut.mutate()}
                >
                  Импортировать каталог
                </Button>
              </div>
              <div className="rounded-lg border border-steel-200 p-4">
                <h4 className="mb-1 font-medium text-steel-900">Датасеты объектов</h4>
                <p className="mb-3 text-xs text-steel-500">
                  Параметры объектов (XLSX) → схемы Склад / Аэропорт / Медицинское учреждение
                </p>
                <Button
                  variant="outline"
                  loading={sourceDatasetsMut.isPending}
                  onClick={() => sourceDatasetsMut.mutate()}
                >
                  Импортировать датасеты
                </Button>
              </div>
              <div className="rounded-lg border border-steel-200 p-4">
                <h4 className="mb-1 font-medium text-steel-900">Примеры из DOCX</h4>
                <p className="mb-3 text-xs text-steel-500">
                  `Примеры_решений_типы_объектов.docx` — обогащение сопоставленных
                  роботов (ТТХ, грузоподъёмность и ссылки при пустых полях).
                </p>
                <Button
                  variant="outline"
                  loading={docxExamplesMut.isPending}
                  onClick={() => docxExamplesMut.mutate()}
                >
                  Обогатить из DOCX
                </Button>
              </div>
            </div>
            {lastImportResult && (
              <div className="mt-4 rounded-lg border border-steel-200 bg-steel-50 p-4 text-sm text-steel-800">
                <p className="mb-2 font-medium text-steel-900">Результат последней операции</p>
                <p>{summarizeImport(lastImportResult, 'Импорт завершён')}</p>
                {Array.isArray(lastImportResult.unmatched_hints) &&
                  (lastImportResult.unmatched_hints as string[]).length > 0 && (
                    <p className="mt-2 text-amber-800">
                      Не сопоставлено:{' '}
                      {(lastImportResult.unmatched_hints as string[]).join(', ')}
                    </p>
                  )}
              </div>
            )}
          </Card>

          <Card title="История партий импорта">
            {batchesQuery.isLoading && <SkeletonRows />}
            {batchesQuery.isError && (
              <p className="text-sm text-red-600">{getFriendlyError(batchesQuery.error)}</p>
            )}
            {!batchesQuery.isLoading && !batchesQuery.isError && (
              <>
                {(batchesQuery.data?.length ?? 0) === 0 ? (
                  <EmptyState
                    title="Партий пока нет"
                    description="Запустите импорт каталога или датасетов — запись появится здесь."
                  />
                ) : (
                  <div className="overflow-hidden rounded border border-steel-200">
                    <Table
                      columns={[
                        {
                          key: 'file',
                          header: 'Файл',
                          render: (b) => b.filename,
                        },
                        {
                          key: 'type',
                          header: 'Тип',
                          render: (b) => {
                            const name = (b.filename || '').toLowerCase()
                            if (name.endsWith('.csv')) return 'CSV'
                            if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'XLSX'
                            if (name.endsWith('.docx')) return 'DOCX'
                            return '—'
                          },
                        },
                        {
                          key: 'date',
                          header: 'Дата',
                          render: (b) => formatDateTime(b.imported_at),
                        },
                        {
                          key: 'status',
                          header: 'Статус',
                          render: (b) => (
                            <Badge
                              variant={
                                b.status === 'completed' || b.status === 'ok'
                                  ? 'success'
                                  : b.status === 'failed'
                                    ? 'danger'
                                    : 'warning'
                              }
                            >
                              {b.status === 'completed' || b.status === 'ok'
                                ? 'Завершено'
                                : b.status === 'failed'
                                  ? 'Ошибка'
                                  : importBatchStatusLabel(b.status)}
                            </Badge>
                          ),
                        },
                        { key: 'rows', header: 'Строк', render: (b) => b.total_rows },
                        { key: 'added', header: 'Добавлено', render: (b) => b.added },
                        { key: 'updated', header: 'Обновлено', render: (b) => b.updated },
                        { key: 'skipped', header: 'Пропущено', render: (b) => b.skipped },
                        { key: 'errors', header: 'Ошибки', render: (b) => b.errors },
                        {
                          key: 'detail',
                          header: '',
                          render: (b) => (
                            <Button size="sm" variant="outline" onClick={() => setBatchDetail(b)}>
                              Подробнее
                            </Button>
                          ),
                        },
                      ]}
                      rows={batchesPage.slice}
                      rowKey={(b) => b.id}
                    />
                    <Pagination
                      page={page}
                      pageSize={pageSize}
                      total={batchesPage.total}
                      pageSizeOptions={[10, 20, 50]}
                      onPageChange={setPage}
                      onPageSizeChange={(s) => {
                        setPageSize(s)
                        setPage(1)
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </Card>

          <Modal
            open={!!batchDetail}
            onClose={() => setBatchDetail(null)}
            title="Подробности импорта"
            footer={
              <Button variant="outline" onClick={() => setBatchDetail(null)}>
                Закрыть
              </Button>
            }
          >
            {batchDetail && (
              <div className="space-y-3 text-sm text-steel-700">
                <p>
                  <span className="text-steel-500">Файл:</span> {batchDetail.filename}
                </p>
                <p>
                  <span className="text-steel-500">Статус:</span>{' '}
                  {importBatchStatusLabel(batchDetail.status)}
                </p>
                <p>
                  Строк: {batchDetail.total_rows} · Добавлено: {batchDetail.added} · Обновлено:{' '}
                  {batchDetail.updated} · Пропущено: {batchDetail.skipped} · Ошибок:{' '}
                  {batchDetail.errors}
                </p>
                <BatchErrorsTable
                  errors={
                    (
                      batchDetail.report_json as
                        | {
                            errors?: {
                              row?: number
                              column?: string
                              message?: string
                              value?: unknown
                            }[]
                          }
                        | undefined
                    )?.errors || []
                  }
                />
              </div>
            )}
          </Modal>
        </div>
      )}

      {section === 'audit' && (
        <div className="space-y-3">
          <p className="text-sm text-steel-600">
            История действий в системе: кто что изменил и в каком объекте. Повторные строки с разными
            версиями — это последовательные пересчёты экономики.
          </p>
          <AdminTableCard
            loading={auditQuery.isLoading}
            error={auditQuery.error}
            empty={!auditPage.slice.length}
            page={page}
            pageSize={pageSize}
            total={auditPage.total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          >
            <Table
              columns={[
                { key: 'time', header: 'Время', render: (e) => formatDateTime(e.created_at) },
                {
                  key: 'user',
                  header: 'Кто',
                  render: (e) => {
                    if (e.user_name) return e.user_name
                    if (e.user_email) return e.user_email
                    return e.user_id != null ? `Пользователь №${e.user_id}` : 'Система'
                  },
                },
                { key: 'action', header: 'Действие', render: (e) => auditActionLabel(e.action) },
                {
                  key: 'entity',
                  header: 'Объект',
                  render: (e) => formatAuditEntity(e.entity_type, e.entity_id, e.entity_name),
                },
                {
                  key: 'details',
                  header: 'Подробности',
                  render: (e) => formatAuditDetails(e.details, e.action),
                },
              ]}
              rows={auditPage.slice}
              rowKey={(e) => e.id}
            />
          </AdminTableCard>
        </div>
      )}
    </div>
  )
}

function toDict(o: ObjectTypeMeta | SolutionType): DictionaryItem {
  return { id: o.id, code: o.code, name: o.name_ru, name_ru: o.name_ru }
}

function AdminTableCard({
  loading,
  error,
  empty,
  children,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  loading: boolean
  error: unknown
  empty: boolean
  children: ReactNode
  page: number
  pageSize: number
  total: number
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
}) {
  return (
    <div className="page-surface overflow-hidden">
      {loading && <SkeletonRows />}
      {!!error && <p className="p-4 text-sm text-red-600">{getFriendlyError(error)}</p>}
      {!loading && !error && empty && (
        <EmptyState title="Данные отсутствуют" description="Записи для выбранного раздела не найдены." />
      )}
      {!loading && !error && !empty && children}
      {!loading && !error && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          pageSizeOptions={[10, 20, 50]}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  )
}

function BatchErrorsTable({
  errors,
}: {
  errors: { row?: number; column?: string; message?: string; value?: unknown }[]
}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const total = errors.length
  const slice = errors.slice((page - 1) * pageSize, page * pageSize)

  if (!total) {
    return <p className="text-steel-500">Список ошибок пуст.</p>
  }

  return (
    <div className="overflow-hidden rounded-lg border border-steel-200">
      <Table
        columns={[
          {
            key: 'row',
            header: 'Строка',
            render: (e) => e.row ?? '—',
          },
          {
            key: 'col',
            header: 'Поле',
            render: (e) => e.column ?? '—',
          },
          {
            key: 'val',
            header: 'Значение',
            render: (e) => (e.value != null ? String(e.value) : '—'),
          },
          {
            key: 'msg',
            header: 'Причина',
            render: (e) => e.message || '—',
          },
        ]}
        rows={slice}
        rowKey={(e) => `${e.row}-${e.column}-${e.message}`}
      />
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        pageSizeOptions={[10, 20, 50]}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s)
          setPage(1)
        }}
      />
    </div>
  )
}

function DictSection({
  kind,
  title,
  loading,
  error,
  items,
  needCode,
  onChanged,
}: {
  kind: 'manufacturers' | 'object-types' | 'solution-types' | 'sources'
  title: string
  loading: boolean
  error: unknown
  items: DictionaryItem[]
  needCode?: boolean
  onChanged: () => void
}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DictionaryItem | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DictionaryItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const total = items.length
  const slice = items.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(1)
  }, [items.length])

  const openCreate = () => {
    setEditing(null)
    setName('')
    setCode('')
    setFieldError('')
    setModalOpen(true)
  }

  const openEdit = (item: DictionaryItem) => {
    setEditing(item)
    setName(item.name || item.name_ru || '')
    setCode(item.code || '')
    setFieldError('')
    setModalOpen(true)
  }

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setFieldError('Укажите название')
      return
    }
    const codeValue = code.trim() || trimmed.toLowerCase().replace(/\s+/g, '_')
    if (needCode && !codeValue) {
      setFieldError('Укажите код')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        if (kind === 'manufacturers') {
          await adminApi.updateManufacturer(editing.id, {
            name: trimmed,
            country: code.trim() || undefined,
          })
        } else if (kind === 'object-types') {
          await adminApi.updateObjectType(editing.id, { name_ru: trimmed, code: codeValue })
        } else if (kind === 'solution-types') {
          await adminApi.updateSolutionType(editing.id, { name_ru: trimmed, code: codeValue })
        } else {
          await adminApi.updateSource(editing.id, {
            name: trimmed,
            url: code.trim() || undefined,
          })
        }
        toastSuccess('Запись обновлена')
      } else if (kind === 'manufacturers') {
        await adminApi.createManufacturer({ name: trimmed, country: code.trim() || undefined })
        toastSuccess('Запись добавлена')
      } else if (kind === 'object-types') {
        await adminApi.createObjectType({ code: codeValue, name_ru: trimmed })
        toastSuccess('Запись добавлена')
      } else if (kind === 'solution-types') {
        await adminApi.createSolutionType({ code: codeValue, name_ru: trimmed })
        toastSuccess('Запись добавлена')
      } else {
        await adminApi.createSource({ name: trimmed, url: code.trim() || undefined })
        toastSuccess('Запись добавлена')
      }
      setModalOpen(false)
      onChanged()
    } catch (e) {
      toastError(getFriendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      if (kind === 'manufacturers') await adminApi.deleteManufacturer(deleteTarget.id)
      else if (kind === 'object-types') await adminApi.deleteObjectType(deleteTarget.id)
      else if (kind === 'solution-types') await adminApi.deleteSolutionType(deleteTarget.id)
      else await adminApi.deleteSource(deleteTarget.id)
      toastSuccess('Запись удалена')
      setDeleteTarget(null)
      onChanged()
    } catch (e) {
      toastError(getFriendlyError(e))
    } finally {
      setDeleting(false)
    }
  }

  const secondaryLabel =
    kind === 'manufacturers' ? 'Страна' : kind === 'sources' ? 'URL' : 'Код'

  return (
    <Card
      title={title}
      actions={
        <Button size="sm" onClick={openCreate}>
          Добавить
        </Button>
      }
    >
      {loading && <SkeletonRows />}
      {!!error && <p className="text-sm text-red-600">{getFriendlyError(error)}</p>}
      {!loading && !error && total === 0 && (
        <EmptyState
          title="Данные отсутствуют"
          description="Добавьте первую запись."
          actionLabel="Добавить"
          onAction={openCreate}
        />
      )}
      {!loading && !error && total > 0 && (
        <div className="overflow-hidden rounded border border-steel-200">
          <Table
            columns={[
              {
                key: 'name',
                header: 'Название',
                render: (i) => i.name || i.name_ru || '—',
              },
              {
                key: 'code',
                header: secondaryLabel,
                render: (i) => i.code || '—',
              },
              {
                key: 'actions',
                header: '',
                render: (i) => (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(i)}>
                      Изменить
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-700"
                      onClick={() => setDeleteTarget(i)}
                    >
                      Удалить
                    </Button>
                  </div>
                ),
              },
            ]}
            rows={slice}
            rowKey={(i) => i.id}
          />
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            pageSizeOptions={[10, 20, 50]}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s)
              setPage(1)
            }}
          />
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editing ? 'Изменить запись' : 'Новая запись'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Отмена
            </Button>
            <Button onClick={save} loading={saving}>
              Сохранить
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Название"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setFieldError('')
            }}
            error={fieldError && !needCode ? fieldError : undefined}
            autoFocus
          />
          <Input
            label={secondaryLabel}
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              setFieldError('')
            }}
            error={fieldError && needCode ? fieldError : undefined}
            placeholder={
              kind === 'manufacturers'
                ? 'Например: РФ'
                : kind === 'sources'
                  ? 'https://…'
                  : 'латиница_через_подчёркивание'
            }
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        variant="danger"
        title="Удалить запись?"
        confirmLabel="Удалить"
        description={
          deleteTarget ? (
            <>
              «{deleteTarget.name || deleteTarget.name_ru}» будет удалена. Действие необратимо.
            </>
          ) : null
        }
      />
    </Card>
  )
}

function CatalogAdminSection({
  loading,
  error,
  robots,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onChanged,
}: {
  loading: boolean
  error: unknown
  robots: Robot[]
  page: number
  pageSize: number
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
  onChanged: () => void
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Robot | null>(null)
  const [name, setName] = useState('')
  const [manufacturerId, setManufacturerId] = useState('')
  const [solutionTypeId, setSolutionTypeId] = useState('')
  const [payloadKg, setPayloadKg] = useState('')
  const [priceRub, setPriceRub] = useState('')
  const [nameError, setNameError] = useState('')
  const [saving, setSaving] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<Robot | null>(null)
  const [archiving, setArchiving] = useState(false)

  const manufacturersQuery = useQuery({
    queryKey: ['admin-manufacturers'],
    queryFn: () => adminApi.manufacturers(),
  })
  const solutionTypesQuery = useQuery({
    queryKey: ['admin-solution-types'],
    queryFn: () => adminApi.solutionTypes(),
  })

  const manufacturerMap = useMemo(() => {
    const m = new Map<number, string>()
    ;(manufacturersQuery.data || []).forEach((x) => m.set(x.id, x.name))
    return m
  }, [manufacturersQuery.data])

  const solutionMap = useMemo(() => {
    const m = new Map<number, string>()
    ;(solutionTypesQuery.data || []).forEach((x) => m.set(x.id, x.name_ru))
    return m
  }, [solutionTypesQuery.data])

  const total = robots.length
  const slice = robots.slice((page - 1) * pageSize, page * pageSize)

  const openCreate = () => {
    setEditing(null)
    setName('')
    setManufacturerId('')
    setSolutionTypeId('')
    setPayloadKg('')
    setPriceRub('')
    setNameError('')
    setModalOpen(true)
  }

  const openEdit = (r: Robot) => {
    setEditing(r)
    setName(r.name)
    setManufacturerId(r.manufacturer_id != null ? String(r.manufacturer_id) : '')
    setSolutionTypeId(r.solution_type_id != null ? String(r.solution_type_id) : '')
    setPayloadKg(r.payload_kg != null ? String(r.payload_kg) : '')
    setPriceRub(r.price_rub != null ? String(r.price_rub) : '')
    setNameError('')
    setModalOpen(true)
  }

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('Укажите название')
      return
    }
    setSaving(true)
    const payload = {
      name: trimmed,
      manufacturer_id: manufacturerId ? Number(manufacturerId) : null,
      solution_type_id: solutionTypeId ? Number(solutionTypeId) : null,
      payload_kg: payloadKg ? Number(payloadKg) : null,
      price_rub: priceRub ? Number(priceRub) : null,
      confirmation_level: editing?.confirmation_level || 'needs_review',
    }
    try {
      if (editing) {
        await adminApi.updateRobot(editing.id, payload)
        toastSuccess('Решение обновлено')
      } else {
        await adminApi.createRobot(payload)
        toastSuccess('Решение создано')
      }
      setModalOpen(false)
      onChanged()
    } catch (e) {
      toastError(getFriendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  const confirmArchive = async () => {
    if (!archiveTarget) return
    setArchiving(true)
    try {
      await adminApi.deleteRobot(archiveTarget.id)
      toastSuccess('Решение архивировано')
      setArchiveTarget(null)
      onChanged()
    } catch (e) {
      toastError(getFriendlyError(e))
    } finally {
      setArchiving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          Добавить решение
        </Button>
      </div>
      <AdminTableCard
        loading={loading}
        error={error}
        empty={!slice.length}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      >
        <Table
          columns={[
            { key: 'name', header: 'Название', render: (r) => r.name },
            {
              key: 'manufacturer',
              header: 'Производитель',
              render: (r) =>
                (r.manufacturer_id != null && manufacturerMap.get(r.manufacturer_id)) || '—',
            },
            {
              key: 'solution',
              header: 'Тип решения',
              render: (r) =>
                (r.solution_type_id != null && solutionMap.get(r.solution_type_id)) || '—',
            },
            { key: 'price', header: 'Цена', render: (r) => String(r.price_rub ?? '—') },
            {
              key: 'archived',
              header: 'Архив',
              render: (r) => (r.archived ? 'Да' : 'Нет'),
            },
            {
              key: 'actions',
              header: '',
              render: (r) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                    Изменить
                  </Button>
                  {!r.archived && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-700"
                      onClick={() => setArchiveTarget(r)}
                    >
                      В архив
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
          rows={slice}
          rowKey={(r) => r.id}
        />
      </AdminTableCard>

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editing ? 'Изменить решение' : 'Новое решение'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Отмена
            </Button>
            <Button onClick={save} loading={saving}>
              Сохранить
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            className="sm:col-span-2"
            label="Название"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setNameError('')
            }}
            error={nameError}
            autoFocus
          />
          <SearchableSelect
            label="Производитель"
            value={manufacturerId}
            onChange={setManufacturerId}
            placeholder="Не указан"
            searchPlaceholder="Поиск производителя…"
            options={(manufacturersQuery.data || []).map((m) => ({
              value: m.id,
              label: m.name,
            }))}
          />
          <SearchableSelect
            label="Тип решения"
            value={solutionTypeId}
            onChange={setSolutionTypeId}
            placeholder="Не указан"
            searchPlaceholder="Поиск типа…"
            options={(solutionTypesQuery.data || []).map((t) => ({
              value: t.id,
              label: t.name_ru,
            }))}
          />
          <Input
            label="Грузоподъёмность, кг"
            type="number"
            value={payloadKg}
            onChange={(e) => setPayloadKg(e.target.value)}
          />
          <Input
            label="Цена, ₽"
            type="number"
            value={priceRub}
            onChange={(e) => setPriceRub(e.target.value)}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!archiveTarget}
        onClose={() => !archiving && setArchiveTarget(null)}
        onConfirm={confirmArchive}
        loading={archiving}
        variant="danger"
        title="Архивировать решение?"
        confirmLabel="В архив"
        description={
          archiveTarget ? (
            <>
              «{archiveTarget.name}» будет скрыто из активного каталога (архивация, не физическое
              удаление).
            </>
          ) : null
        }
      />
    </div>
  )
}

function NormsSection({
  loading,
  error,
  items,
  onSave,
}: {
  loading: boolean
  error: unknown
  items: Normative[]
  onSave: (id: number, value: number) => void
}) {
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const total = items.length
  const slice = items.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    const next: Record<number, string> = {}
    items.forEach((n) => {
      next[n.id] = String(n.value)
    })
    setDrafts(next)
  }, [items])

  useEffect(() => {
    setPage(1)
  }, [items.length])

  return (
    <Card title="Нормативы">
      {loading && <SkeletonRows />}
      {!!error && <p className="text-sm text-red-600">{getFriendlyError(error)}</p>}
      {!loading && !error && total === 0 && (
        <EmptyState title="Данные отсутствуют" description="Нормативы не загружены." />
      )}
      {!loading && !error && total > 0 && (
        <div className="overflow-hidden rounded border border-steel-200">
          <Table
            columns={[
              { key: 'code', header: 'Код', render: (n) => n.code },
              { key: 'name', header: 'Название', render: (n) => n.name_ru },
              {
                key: 'value',
                header: 'Значение',
                render: (n) => (
                  <Input
                    className="w-32"
                    value={drafts[n.id] ?? ''}
                    disabled={!n.editable}
                    onChange={(e) => setDrafts((d) => ({ ...d, [n.id]: e.target.value }))}
                  />
                ),
              },
              { key: 'unit', header: 'Ед.', render: (n) => n.unit || '—' },
              {
                key: 'actions',
                header: '',
                render: (n) =>
                  n.editable ? (
                    <Button size="sm" onClick={() => onSave(n.id, Number(drafts[n.id]))}>
                      Сохранить
                    </Button>
                  ) : (
                    '—'
                  ),
              },
            ]}
            rows={slice}
            rowKey={(n) => n.id}
          />
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            pageSizeOptions={[10, 20, 50]}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s)
              setPage(1)
            }}
          />
        </div>
      )}
    </Card>
  )
}
