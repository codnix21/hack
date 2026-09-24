import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, PlayCircle } from 'lucide-react'
import { catalogApi } from '../api/catalog'
import { demoApi } from '../api/projects'
import { getFriendlyError } from '../api/client'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { Pagination } from '../components/ui/Pagination'
import { SkeletonCards } from '../components/ui/Skeleton'
import { toastError, toastSuccess } from '../store/toastStore'
import { useAuthStore } from '../store/authStore'

export function DemoPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isGuest = useAuthStore((s) => s.isGuest)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const query = useQuery({
    queryKey: ['demos'],
    queryFn: () => demoApi.list(),
  })

  const objectTypesQuery = useQuery({
    queryKey: ['object-types'],
    queryFn: () => catalogApi.objectTypes(),
  })

  const objectTypeMap = useMemo(() => {
    const m = new Map<number, string>()
    ;(objectTypesQuery.data || []).forEach((o) => m.set(o.id, o.name_ru))
    return m
  }, [objectTypesQuery.data])

  const demos = query.data || []
  const total = demos.length
  const pageItems = demos.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(1)
  }, [total])

  const cloneMut = useMutation({
    mutationFn: demoApi.clone,
    onSuccess: (p) => {
      toastSuccess('Демо-проект скопирован в ваши проекты')
      qc.invalidateQueries({ queryKey: ['projects'] })
      navigate(`/app/projects/${p.id}?step=params`)
    },
    onError: (e) => toastError(getFriendlyError(e)),
  })

  return (
    <div>
      <PageHeader
        title="Демонстрационные проекты"
        subtitle="Готовые сценарии для быстрого знакомства с платформой (демонстрационные данные)"
        crumbs={[
          { label: 'Панель управления', to: '/app' },
          { label: 'Демонстрация' },
        ]}
      />

      {query.isLoading && <SkeletonCards count={3} />}
      {query.isError && (
        <div className="page-surface p-6 text-sm text-red-600">{getFriendlyError(query.error)}</div>
      )}
      {!query.isLoading && !query.isError && total === 0 && (
        <div className="page-surface">
          <EmptyState
            title="Демонстрационные проекты недоступны"
            description="Сервер не вернул готовые сценарии. Создайте собственный проект."
            actionLabel="Создать проект"
            onAction={() => navigate('/app/projects/new')}
          />
        </div>
      )}

      {total > 0 && (
        <div className="page-surface overflow-hidden">
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {pageItems.map((p) => (
              <article key={p.id} className="rounded border border-steel-200 p-5">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-semibold text-steel-900">
                    {p.name.startsWith('Демо') ? p.name : `Демо: ${p.name}`}
                  </h3>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="warning">Демо</Badge>
                    <Badge variant="info">
                      {(p.object_type_id != null && objectTypeMap.get(p.object_type_id)) ||
                        'Сценарий'}
                    </Badge>
                  </div>
                </div>
                <p className="mb-4 text-sm text-steel-600">
                  {p.description || 'Готовый демонстрационный сценарий'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => navigate(`/app/projects/${p.id}?step=params`)}>
                    <PlayCircle className="h-4 w-4" />
                    Открыть
                  </Button>
                  {!isGuest && (
                    <Button
                      variant="outline"
                      loading={cloneMut.isPending}
                      onClick={() => cloneMut.mutate(p.id)}
                    >
                      <Copy className="h-4 w-4" />
                      Клонировать
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
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
    </div>
  )
}
