import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  Copy,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { catalogApi } from '../api/catalog'
import { projectsApi } from '../api/projects'
import { getFriendlyError } from '../api/client'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { SkeletonCards } from '../components/ui/Skeleton'
import { Pagination } from '../components/ui/Pagination'
import { ConfirmDialog } from '../components/ui/Modal'
import { toastError, toastSuccess } from '../store/toastStore'
import { formatDate, PROJECT_STATUS_LABELS } from '../utils/format'
import type { Project } from '../types'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

type ConfirmAction = { type: 'delete' | 'archive'; project: Project }

export function ProjectsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [objectTypeId, setObjectTypeId] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null)

  const metaQuery = useQuery({
    queryKey: ['object-types'],
    queryFn: () => catalogApi.objectTypes(),
  })

  const objectTypeMap = useMemo(() => {
    const m = new Map<number, string>()
    ;(metaQuery.data || []).forEach((o) => m.set(o.id, o.name_ru))
    return m
  }, [metaQuery.data])

  const query = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
  })

  const removeMut = useMutation({
    mutationFn: projectsApi.remove,
    onSuccess: () => {
      toastSuccess('Проект удалён')
      setConfirm(null)
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const copyMut = useMutation({
    mutationFn: projectsApi.copy,
    onSuccess: (p) => {
      toastSuccess('Проект скопирован')
      navigate(`/app/projects/${p.id}`)
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const archiveMut = useMutation({
    mutationFn: projectsApi.archive,
    onSuccess: () => {
      toastSuccess('Проект архивирован')
      setConfirm(null)
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  const filtered = useMemo(() => {
    let items = query.data || []
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q),
      )
    }
    if (status) items = items.filter((p) => p.status === status)
    if (objectTypeId) {
      const oid = Number(objectTypeId)
      items = items.filter((p) => p.object_type_id === oid)
    }
    return items
  }, [query.data, search, status, objectTypeId])

  const total = filtered.length
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize)
  const actionPending = removeMut.isPending || archiveMut.isPending

  const statusVariant = useMemo(
    () =>
      ({
        draft: 'default',
        active: 'info',
        archived: 'warning',
        completed: 'success',
      }) as const,
    [],
  )

  const onConfirmAction = () => {
    if (!confirm) return
    if (confirm.type === 'delete') removeMut.mutate(confirm.project.id)
    else archiveMut.mutate(confirm.project.id)
  }

  return (
    <div>
      <PageHeader
        title="Мои проекты"
        subtitle="Управление проектами подбора роботизированных решений"
        crumbs={[
          { label: 'Панель управления', to: '/app' },
          { label: 'Мои проекты' },
        ]}
        actions={
          <Link to="/app/projects/new">
            <Button>
              <Plus className="h-4 w-4" />
              Создать проект
            </Button>
          </Link>
        }
      />

      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <Input
          placeholder="Поиск по названию…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          aria-label="Поиск"
        />
        <Select
          placeholder="Фильтр: статус"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          options={[
            { value: 'draft', label: 'Черновик' },
            { value: 'active', label: 'Активный' },
            { value: 'archived', label: 'В архиве' },
            { value: 'completed', label: 'Завершён' },
          ]}
        />
        <SearchableSelect
          placeholder="Фильтр: тип объекта"
          value={objectTypeId}
          onChange={(v) => {
            setObjectTypeId(v)
            setPage(1)
          }}
          options={(metaQuery.data || []).map((o) => ({
            value: o.id,
            label: o.name_ru,
          }))}
          searchPlaceholder="Поиск типа объекта…"
          aria-label="Тип объекта"
        />
      </div>

      {query.isLoading && <SkeletonCards count={6} />}
      {query.isError && (
        <div className="page-surface p-6 text-sm text-red-600">
          {getFriendlyError(query.error)}
        </div>
      )}
      {!query.isLoading && !query.isError && pageItems.length === 0 && (
        <div className="page-surface">
          <EmptyState
            title="Проектов пока нет"
            description="Создайте первый проект или откройте демонстрационный сценарий."
            actionLabel="Создать проект"
            onAction={() => navigate('/app/projects/new')}
          />
        </div>
      )}

      {!query.isLoading && pageItems.length > 0 && (
        <div className="page-surface overflow-hidden">
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {pageItems.map((p) => (
              <article key={p.id} className="rounded border border-steel-200 bg-steel-50/40 p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display font-semibold text-steel-900">{p.name}</h3>
                    <p className="mt-1 text-xs text-steel-500">
                      {(p.object_type_id != null && objectTypeMap.get(p.object_type_id)) ||
                        'Тип не задан'}{' '}
                      · обновлён {formatDate(p.updated_at)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {p.is_demo && (
                      <Badge
                        variant="warning"
                        title="Демонстрационные данные используются для показа возможностей платформы"
                      >
                        Демонстрационные данные
                      </Badge>
                    )}
                    <Badge variant={statusVariant[p.status as keyof typeof statusVariant] || 'default'}>
                      {PROJECT_STATUS_LABELS[p.status] || p.status}
                    </Badge>
                  </div>
                </div>
                {p.description && (
                  <p className="mb-3 line-clamp-2 text-sm text-steel-600">{p.description}</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" onClick={() => navigate(`/app/projects/${p.id}`)}>
                    Открыть
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/app/projects/${p.id}/edit`)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Изменить
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => copyMut.mutate(p.id)}>
                    <Copy className="h-3.5 w-3.5" />
                    Копировать
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        const blob = await projectsApi.exportPdf(p.id)
                        downloadBlob(blob, `${p.name}.pdf`)
                        toastSuccess('PDF экспортирован')
                      } catch (e) {
                        toastError(getFriendlyError(e))
                      }
                    }}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Экспортировать
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        const blob = await projectsApi.exportExcel(p.id)
                        downloadBlob(blob, `${p.name}.xlsx`)
                        toastSuccess('Excel экспортирован')
                      } catch (e) {
                        toastError(getFriendlyError(e))
                      }
                    }}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={actionPending}
                    onClick={() => setConfirm({ type: 'archive', project: p })}
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Архивировать
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-700"
                    disabled={actionPending}
                    onClick={() => setConfirm({ type: 'delete', project: p })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Удалить
                  </Button>
                </div>
              </article>
            ))}
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s)
              setPage(1)
            }}
          />
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => {
          if (!actionPending) setConfirm(null)
        }}
        onConfirm={onConfirmAction}
        loading={actionPending}
        variant={confirm?.type === 'delete' ? 'danger' : 'default'}
        title={confirm?.type === 'delete' ? 'Удалить проект?' : 'Архивировать проект?'}
        confirmLabel={confirm?.type === 'delete' ? 'Удалить' : 'Архивировать'}
        description={
          confirm?.type === 'delete' ? (
            <>
              Проект «{confirm.project.name}» будет удалён без возможности восстановления.
              Связанные расчёты и сценарии также будут удалены.
            </>
          ) : confirm ? (
            <>
              Проект «{confirm.project.name}» будет переведён в архив. Его можно будет найти
              фильтром «В архиве».
            </>
          ) : null
        }
      />
    </div>
  )
}
