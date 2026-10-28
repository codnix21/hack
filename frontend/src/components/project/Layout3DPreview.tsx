/**
 * Пространственный режим планировки: та же WarehouseLayout, что и 2D.
 * Правка геометрии — в «План»; здесь — обзор, слои, выбор объекта.
 */
import { lazy, Suspense, useMemo, useState } from 'react'
import type { WarehouseLayout } from '../../types'
import { Button } from '../ui/Button'
import { Camera, Eye, RotateCcw } from 'lucide-react'
import {
  DEFAULT_LAYOUT_3D_LAYERS,
  type Layout3DLayers,
  type Layout3DLayer,
} from './Layout3DCanvas'

const Layout3DCanvas = lazy(() =>
  import('./Layout3DCanvas').then((m) => ({ default: m.Layout3DCanvas })),
)

interface Props {
  layout: WarehouseLayout
  selectedId?: string | null
  onSelectId?: (id: string | null) => void
  /** Компактный режим: слои/камера уже в родительском тулбаре */
  embedded?: boolean
  layers?: Layout3DLayers
  onLayersChange?: (next: Layout3DLayers) => void
  cameraMode?: 'iso' | 'top'
  onCameraModeChange?: (mode: 'iso' | 'top') => void
  fitNonce?: number
  onFitRequest?: () => void
}

const LAYER_LABELS: { key: Layout3DLayer; label: string }[] = [
  { key: 'grid', label: 'Сетка' },
  { key: 'equipment', label: 'Стеллажи' },
  { key: 'obstacles', label: 'Препятствия' },
  { key: 'zones', label: 'Зоны' },
  { key: 'routes', label: 'Маршруты' },
  { key: 'labels', label: 'Подписи' },
]

export function Layout3DPreview({
  layout,
  selectedId = null,
  onSelectId,
  embedded = false,
  layers: layersProp,
  onLayersChange,
  cameraMode: cameraModeProp,
  onCameraModeChange,
  fitNonce: fitNonceProp,
  onFitRequest,
}: Props) {
  const [localLayers, setLocalLayers] = useState<Layout3DLayers>(DEFAULT_LAYOUT_3D_LAYERS)
  const [localCam, setLocalCam] = useState<'iso' | 'top'>('iso')
  const [localFit, setLocalFit] = useState(0)

  const layers = layersProp ?? localLayers
  const setLayers = onLayersChange ?? setLocalLayers
  const cameraMode = cameraModeProp ?? localCam
  const setCameraMode = onCameraModeChange ?? setLocalCam
  const fitNonce = fitNonceProp ?? localFit

  const requestFit = () => {
    if (onFitRequest) onFitRequest()
    else setLocalFit((n) => n + 1)
  }

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
          Вернитесь в режим «План». Редактирование планировки там не теряется.
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
        Нет объектов для 3D. Добавьте стеллажи или маршруты в режиме «План».
      </div>
    )
  }

  const layerBar = (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--nc-muted)]"
      data-testid="layout-3d-layers"
      role="group"
      aria-label="Слои сцены"
    >
      <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {LAYER_LABELS.map(({ key, label }) => (
        <label key={key} className="inline-flex cursor-pointer items-center gap-1">
          <input
            type="checkbox"
            className="rounded border-[var(--nc-border)]"
            checked={layers[key]}
            data-testid={`layout-3d-layer-${key}`}
            onChange={(e) => setLayers({ ...layers, [key]: e.target.checked })}
          />
          {label}
        </label>
      ))}
    </div>
  )

  const camBar = (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Камера">
      <Button
        size="sm"
        variant={cameraMode === 'iso' ? 'primary' : 'outline'}
        data-testid="layout-3d-cam-iso"
        aria-pressed={cameraMode === 'iso'}
        onClick={() => {
          setCameraMode('iso')
          requestFit()
        }}
      >
        Изометрия
      </Button>
      <Button
        size="sm"
        variant={cameraMode === 'top' ? 'primary' : 'outline'}
        data-testid="layout-3d-cam-top"
        aria-pressed={cameraMode === 'top'}
        onClick={() => {
          setCameraMode('top')
          requestFit()
        }}
      >
        Сверху
      </Button>
      <Button size="sm" variant="outline" data-testid="layout-3d-fit" onClick={requestFit}>
        <Camera className="h-3.5 w-3.5" />
        Весь склад
      </Button>
      <Button
        size="sm"
        variant="outline"
        data-testid="layout-3d-cam-reset"
        title="Сбросить ракурс"
        onClick={() => {
          setCameraMode('iso')
          requestFit()
        }}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  )

  return (
    <div className="flex h-full min-h-[420px] flex-col gap-2" data-testid="layout-3d-preview">
      {!embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <p className="text-xs text-[var(--nc-muted)]">
              Пространство · границы {layout.width_m}×{layout.length_m} м · 1 ед. = 1 м · правка — в
              «План»
            </p>
            {layerBar}
          </div>
          {camBar}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <Suspense
          fallback={
            <div className="flex h-full min-h-[420px] items-center justify-center rounded border border-[var(--nc-border)] bg-[var(--nc-canvas)] text-sm text-[var(--nc-muted)]">
              Загрузка 3D…
            </div>
          }
        >
          <Layout3DCanvas
            layout={layout}
            selectedId={selectedId}
            onSelectId={onSelectId}
            fitNonce={fitNonce}
            cameraMode={cameraMode}
            layers={layers}
          />
        </Suspense>
      </div>
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--nc-border-subtle)] pt-2">
          {layerBar}
          {camBar}
        </div>
      ) : null}
    </div>
  )
}
