/**
 * Read-only 3D preview of WarehouseLayout (meters) for the planning editor.
 * Editing stays in 2D; this view shares the same layout object.
 */
import { lazy, Suspense, useMemo, useState } from 'react'
import type { WarehouseLayout } from '../../types'
import { Button } from '../ui/Button'
import { Camera } from 'lucide-react'

const Layout3DCanvas = lazy(() =>
  import('./Layout3DCanvas').then((m) => ({ default: m.Layout3DCanvas })),
)

interface Props {
  layout: WarehouseLayout
  selectedId?: string | null
  onSelectId?: (id: string | null) => void
}

export function Layout3DPreview({ layout, selectedId = null, onSelectId }: Props) {
  const [cameraKey, setCameraKey] = useState(0)
  const webglOk = useMemo(() => {
    try {
      const c = document.createElement('canvas')
      return !!(c.getContext('webgl') || c.getContext('experimental-webgl'))
    } catch {
      return false
    }
  }, [])

  if (!webglOk) {
    return (
      <div
        className="flex min-h-[360px] flex-col items-center justify-center gap-2 rounded border border-dashed border-[var(--nc-border)] bg-[var(--nc-surface-muted)] p-6 text-center"
        data-testid="layout-3d-webgl-fallback"
      >
        <p className="text-sm font-medium text-[var(--nc-ink)]">WebGL недоступен</p>
        <p className="max-w-sm text-sm text-[var(--nc-text)]">
          Вернитесь в режим «2D — План». Редактирование планировки там не теряется.
        </p>
      </div>
    )
  }

  if (!layout.objects?.length && !(layout.routes || []).length) {
    return (
      <div
        className="flex min-h-[360px] items-center justify-center rounded border border-[var(--nc-border)] bg-[var(--nc-surface-muted)] p-6 text-sm text-[var(--nc-muted)]"
        data-testid="layout-3d-empty"
      >
        Нет объектов для 3D. Добавьте стеллажи или маршруты в режиме 2D.
      </div>
    )
  }

  return (
    <div className="space-y-2" data-testid="layout-3d-preview">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--nc-muted)]">
          Пространственный вид · 1 ед. = 1 м · редактирование — в 2D
        </p>
        <Button
          size="sm"
          variant="outline"
          data-testid="layout-3d-fit"
          onClick={() => setCameraKey((k) => k + 1)}
        >
          <Camera className="h-3.5 w-3.5" />
          Весь склад
        </Button>
      </div>
      <Suspense
        fallback={
          <div className="flex h-[min(56vh,480px)] items-center justify-center rounded border border-[var(--nc-border)] bg-[var(--nc-canvas)] text-sm text-[var(--nc-muted)]">
            Загрузка 3D…
          </div>
        }
      >
        <Layout3DCanvas
          key={cameraKey}
          layout={layout}
          selectedId={selectedId}
          onSelectId={onSelectId}
        />
      </Suspense>
    </div>
  )
}
