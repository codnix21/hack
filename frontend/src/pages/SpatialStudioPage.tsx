/**
 * NETCORE Spatial Studio — полноэкранный пространственный редактор планировки.
 * Маршрут: /app/projects/:id/spatial (вне AppShell).
 * Источник истины: WarehouseLayout через projectsApi.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Box,
  Camera,
  Crosshair,
  Move,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Undo2,
} from 'lucide-react'
import {
  clampObjectToRoom,
  normalizeRotationDeg,
  snapObjectPosition,
  snapRotationDeg,
} from '../components/spatial/spatialMath'
import { projectsApi } from '../api/projects'
import { getFriendlyError } from '../api/client'
import type { LayoutObject, WarehouseLayout } from '../types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { UnsavedChangesGuard } from '../components/project/UnsavedChangesGuard'
import {
  DEFAULT_LAYOUT_3D_LAYERS,
  type Layout3DLayers,
} from '../components/project/Layout3DCanvas'
import {
  LAYOUT_KIND_OPTIONS,
  layoutKindLabel,
  newLayoutObjectId,
  type SpatialSaveStatus,
  type SpatialTool,
} from '../components/spatial/layoutKinds'
import { toastError, toastSuccess } from '../store/toastStore'

const SpatialSceneCanvas = lazy(() =>
  import('../components/spatial/SpatialSceneCanvas').then((m) => ({
    default: m.SpatialSceneCanvas,
  })),
)

function cloneLayout(l: WarehouseLayout): WarehouseLayout {
  return structuredClone(l)
}

function statusLabel(s: SpatialSaveStatus): string {
  if (s === 'saved') return 'Сохранено'
  if (s === 'dirty') return 'Есть изменения'
  if (s === 'saving') return 'Сохранение…'
  return 'Ошибка сохранения'
}

export function SpatialStudioPage() {
  const { id } = useParams<{ id: string }>()
  const projectId = id || ''
  const navigate = useNavigate()
  const qc = useQueryClient()

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
    enabled: Boolean(projectId),
  })

  const layoutQuery = useQuery({
    queryKey: ['project-layout', projectId],
    queryFn: () => projectsApi.getLayout(projectId),
    enabled: Boolean(projectId),
  })

  const [layout, setLayout] = useState<WarehouseLayout | null>(null)
  const [baseline, setBaseline] = useState<WarehouseLayout | null>(null)
  const pastRef = useRef<WarehouseLayout[]>([])
  const futureRef = useRef<WarehouseLayout[]>([])
  const [pastLen, setPastLen] = useState(0)
  const [futureLen, setFutureLen] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tool, setTool] = useState<SpatialTool>('select')
  const [rightOpen, setRightOpen] = useState(true)
  const [rightTab, setRightTab] = useState<'objects' | 'props' | 'scene'>('objects')
  const [layers, setLayers] = useState<Layout3DLayers>(DEFAULT_LAYOUT_3D_LAYERS)
  const [cameraMode, setCameraMode] = useState<'iso' | 'top'>('iso')
  const [fitNonce, setFitNonce] = useState(0)
  const [saveStatus, setSaveStatus] = useState<SpatialSaveStatus>('saved')
  /** Привязка к сетке: применяется только при commit перемещения/угла, не при включении. */
  const [snapEnabled, setSnapEnabled] = useState(false)
  const [gridStepM, setGridStepM] = useState(0.5)
  const [rotationStepDeg, setRotationStepDeg] = useState(15)
  const [webglOk] = useState(() => {
    try {
      const c = document.createElement('canvas')
      return !!(c.getContext('webgl') || c.getContext('experimental-webgl'))
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (layoutQuery.data) {
      const next = cloneLayout(layoutQuery.data)
      setLayout(next)
      setBaseline(cloneLayout(layoutQuery.data))
      setSaveStatus('saved')
      pastRef.current = []
      futureRef.current = []
      setPastLen(0)
      setFutureLen(0)
      setFitNonce((n) => n + 1)
    }
  }, [layoutQuery.data])

  const readOnly = Boolean(projectQuery.data?.is_demo)
  const dirty = saveStatus === 'dirty' || saveStatus === 'error'

  const commitLayout = useCallback(
    (next: WarehouseLayout, pushHistory = true) => {
      setLayout((prev) => {
        if (pushHistory && prev) {
          pastRef.current.push(cloneLayout(prev))
          if (pastRef.current.length > 40) pastRef.current.shift()
          futureRef.current = []
          setPastLen(pastRef.current.length)
          setFutureLen(0)
        }
        return next
      })
      setSaveStatus('dirty')
    },
    [],
  )

  const undo = () => {
    const prev = pastRef.current.pop()
    setPastLen(pastRef.current.length)
    if (!prev || !layout) return
    futureRef.current.push(cloneLayout(layout))
    setFutureLen(futureRef.current.length)
    setLayout(prev)
    setSaveStatus('dirty')
    toastSuccess('Отменено (локально, до сохранения)')
  }

  const redo = () => {
    const next = futureRef.current.pop()
    setFutureLen(futureRef.current.length)
    if (!next || !layout) return
    pastRef.current.push(cloneLayout(layout))
    setPastLen(pastRef.current.length)
    setLayout(next)
    setSaveStatus('dirty')
    toastSuccess('Повторено (локально, до сохранения)')
  }

  const patchObject = useCallback(
    (objectId: string, patch: Partial<LayoutObject>) => {
      if (!layout || readOnly) return
      commitLayout({
        ...layout,
        objects: layout.objects.map((o) => {
          if (o.id !== objectId) return o
          const merged = { ...o, ...patch }
          if ('x' in patch || 'y' in patch || 'width' in patch || 'height' in patch) {
            const clamped = clampObjectToRoom(layout, merged)
            merged.x = clamped.x
            merged.y = clamped.y
          }
          if ('rotation' in patch && patch.rotation != null) {
            merged.rotation = normalizeRotationDeg(Number(patch.rotation) || 0)
          }
          return merged
        }),
      })
    },
    [layout, readOnly, commitLayout],
  )

  /** Числовой ввод координат: snap при blur только если включён; toggle snap не трогает объекты. */
  const commitNumericPosition = useCallback(
    (objectId: string, x: number, y: number) => {
      if (!layout || readOnly) return
      const o = layout.objects.find((obj) => obj.id === objectId)
      if (!o) return
      let next = { x, y }
      next = snapObjectPosition(next.x, next.y, gridStepM, snapEnabled)
      next = clampObjectToRoom(layout, { ...o, ...next })
      if (next.x === o.x && next.y === o.y) return
      patchObject(objectId, next)
    },
    [layout, readOnly, gridStepM, snapEnabled, patchObject],
  )

  const commitNumericRotation = useCallback(
    (objectId: string, deg: number) => {
      if (!layout || readOnly) return
      const o = layout.objects.find((obj) => obj.id === objectId)
      if (!o) return
      const rotation = snapRotationDeg(deg, rotationStepDeg, snapEnabled)
      if (rotation === (o.rotation || 0)) return
      patchObject(objectId, { rotation })
    },
    [layout, readOnly, rotationStepDeg, snapEnabled, patchObject],
  )

  const addObject = (kind: string) => {
    if (!layout || readOnly) return
    const width = kind === 'rack' ? 8 : 4
    const height = kind === 'rack' ? 12 : 3
    const x = Math.max(0, layout.width_m / 2 - width / 2)
    const y = Math.max(0, layout.length_m / 2 - height / 2)
    const obj: LayoutObject = {
      id: newLayoutObjectId(kind),
      kind,
      name: layoutKindLabel(kind),
      x,
      y,
      width,
      height,
      rotation: 0,
    }
    commitLayout({ ...layout, objects: [...layout.objects, obj] })
    setSelectedId(obj.id)
    setTool('move')
    setRightTab('props')
  }

  const saveMut = useMutation({
    mutationFn: () => projectsApi.saveLayout(projectId, layout!),
    onMutate: () => setSaveStatus('saving'),
    onSuccess: () => {
      setBaseline(layout ? cloneLayout(layout) : null)
      setSaveStatus('saved')
      toastSuccess('План склада сохранён')
      void qc.invalidateQueries({ queryKey: ['project-layout', projectId] })
      void qc.invalidateQueries({ queryKey: ['project', projectId] })
      void qc.invalidateQueries({ queryKey: ['visualization', projectId] })
    },
    onError: (e) => {
      setSaveStatus('error')
      toastError(getFriendlyError(e))
    },
  })

  const selected = useMemo(
    () => layout?.objects.find((o) => o.id === selectedId) || null,
    [layout, selectedId],
  )

  const objectTree = useMemo(() => {
    if (!layout) return []
    return layout.objects.filter((o) => o.id !== 'wall_contour')
  }, [layout])

  const backToPlanner = () => navigate(`/app/projects/${projectId}?step=layout`)

  if (layoutQuery.isLoading || projectQuery.isLoading) {
    return (
      <div className="flex h-svh items-center justify-center bg-[var(--nc-bg)] text-sm text-[var(--nc-muted)]">
        Загрузка Spatial Studio…
      </div>
    )
  }

  if (layoutQuery.isError || !layout) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-3 bg-[var(--nc-bg)] p-6">
        <p className="text-sm text-[var(--nc-danger)]">
          {layoutQuery.error ? getFriendlyError(layoutQuery.error) : 'Нет планировки'}
        </p>
        <Button onClick={backToPlanner}>К планированию</Button>
      </div>
    )
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-[var(--nc-bg)] text-[var(--nc-ink)]" data-testid="spatial-studio">
      <UnsavedChangesGuard
        when={dirty && !readOnly}
        title="Несохранённая планировка"
        description="Изменения Spatial Studio не сохранены. Сохранить перед выходом?"
        onSaveAndLeave={async () => {
          await saveMut.mutateAsync()
        }}
        onDiscard={() => {
          if (baseline) setLayout(cloneLayout(baseline))
          setSaveStatus('saved')
        }}
      />

      {/* Top bar */}
      <header
        className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--nc-border)] bg-[var(--nc-surface)] px-2"
        data-testid="spatial-topbar"
      >
        <span className="hidden font-display text-[11px] font-bold uppercase tracking-[0.14em] text-brand-500 sm:inline">
          NETCORE Spatial
        </span>
        <span className="hidden text-[var(--nc-border-strong)] sm:inline" aria-hidden>
          |
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-medium" title={projectQuery.data?.name}>
          {projectQuery.data?.name || `Проект ${projectId}`}
        </p>
        <Badge
          variant={
            saveStatus === 'saved'
              ? 'success'
              : saveStatus === 'dirty'
                ? 'warning'
                : saveStatus === 'saving'
                  ? 'info'
                  : 'danger'
          }
          data-testid="spatial-save-status"
        >
          {statusLabel(saveStatus)}
        </Badge>
        {!readOnly ? (
          <>
            <Button
              size="sm"
              variant="outline"
              data-testid="spatial-undo"
              disabled={pastLen === 0}
              onClick={undo}
              title="Отменить"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              data-testid="spatial-redo"
              disabled={futureLen === 0}
              onClick={redo}
              title="Повторить"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              data-testid="spatial-save"
              loading={saveMut.isPending}
              onClick={() => saveMut.mutate()}
              disabled={saveStatus === 'saved'}
            >
              <Save className="h-3.5 w-3.5" />
              Сохранить
            </Button>
          </>
        ) : (
          <Badge variant="warning">Только просмотр</Badge>
        )}
        <Button size="sm" variant="outline" data-testid="spatial-back" onClick={backToPlanner}>
          <ArrowLeft className="h-3.5 w-3.5" />
          К плану
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Left tool rail */}
        <aside
          className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-[var(--nc-border)] bg-[var(--nc-surface-muted)] py-2"
          data-testid="spatial-tool-rail"
          aria-label="Инструменты"
        >
          {(
            [
              { id: 'select' as const, icon: Crosshair, title: 'Выбор' },
              { id: 'move' as const, icon: Move, title: 'Перемещение' },
              { id: 'rotate' as const, icon: RotateCw, title: 'Вращение' },
            ] as const
          ).map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={tool === t.id ? 'primary' : 'ghost'}
              className="h-9 w-9 p-0"
              data-testid={`spatial-tool-${t.id}`}
              aria-pressed={tool === t.id}
              title={t.title}
              disabled={readOnly && t.id !== 'select'}
              onClick={() => setTool(t.id)}
            >
              <t.icon className="h-4 w-4" />
            </Button>
          ))}
          <div className="my-1 h-px w-8 bg-[var(--nc-border)]" />
          {!readOnly ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 w-9 p-0"
                data-testid="spatial-add-rack"
                title="Стеллаж"
                onClick={() => addObject('rack')}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 w-9 p-0"
                data-testid="spatial-add-obstacle"
                title="Препятствие"
                onClick={() => addObject('obstacle')}
              >
                <Box className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 w-9 p-0 text-[10px] font-semibold"
                title="Зона"
                onClick={() => addObject('zone')}
              >
                Zn
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 w-9 p-0 text-[10px] font-semibold"
                title="Зарядка"
                onClick={() => addObject('charge')}
              >
                ⚡
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 w-9 p-0 text-[10px] font-semibold"
                title="Старт"
                onClick={() => addObject('start')}
              >
                St
              </Button>
            </>
          ) : null}
          <div className="mt-auto flex flex-col gap-1">
            <Button
              size="sm"
              variant={cameraMode === 'iso' ? 'primary' : 'ghost'}
              className="h-9 w-9 p-0 text-[10px]"
              data-testid="spatial-cam-iso"
              title="Перспектива / изометрия"
              onClick={() => {
                setCameraMode('iso')
                setFitNonce((n) => n + 1)
              }}
            >
              3D
            </Button>
            <Button
              size="sm"
              variant={cameraMode === 'top' ? 'primary' : 'ghost'}
              className="h-9 w-9 p-0"
              data-testid="spatial-cam-top"
              title="Сверху"
              onClick={() => {
                setCameraMode('top')
                setFitNonce((n) => n + 1)
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-9 w-9 p-0"
              data-testid="spatial-fit"
              title="Показать весь склад"
              onClick={() => setFitNonce((n) => n + 1)}
            >
              <Camera className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-9 w-9 p-0"
              data-testid="spatial-panel-toggle"
              aria-expanded={rightOpen}
              title={rightOpen ? 'Свернуть панель' : 'Показать панель'}
              onClick={() => setRightOpen((v) => !v)}
            >
              {rightOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </Button>
          </div>
        </aside>

        {/* Scene */}
        <div className="relative min-w-0 flex-1" data-testid="spatial-viewport">
          {!webglOk ? (
            <div
              className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center"
              data-testid="spatial-webgl-fallback"
            >
              <p className="font-medium">WebGL недоступен</p>
              <p className="max-w-sm text-sm text-[var(--nc-muted)]">
                Spatial Studio требует WebGL. Вернитесь к 2D-плану.
              </p>
              <Button onClick={backToPlanner}>К плану</Button>
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-[var(--nc-muted)]">
                  Загрузка сцены…
                </div>
              }
            >
              <SpatialSceneCanvas
                layout={layout}
                selectedId={selectedId}
                onSelectId={(oid) => {
                  setSelectedId(oid)
                  if (oid) setRightTab('props')
                }}
                tool={tool}
                editEnabled={!readOnly}
                onCommitTransform={patchObject}
                fitNonce={fitNonce}
                cameraMode={cameraMode}
                layers={layers}
                snapEnabled={snapEnabled}
                gridStepM={gridStepM}
                rotationStepDeg={rotationStepDeg}
              />
            </Suspense>
          )}
        </div>

        {/* Right panel */}
        {rightOpen ? (
          <aside
            className="flex w-64 shrink-0 flex-col border-l border-[var(--nc-border)] bg-[var(--nc-surface)]"
            data-testid="spatial-right-panel"
          >
            <div className="flex border-b border-[var(--nc-border)]" role="tablist">
              {(
                [
                  { id: 'objects' as const, label: 'Объекты' },
                  { id: 'props' as const, label: 'Свойства' },
                  { id: 'scene' as const, label: 'Сцена' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={rightTab === t.id}
                  className={`flex-1 px-2 py-2 text-xs font-medium ${
                    rightTab === t.id
                      ? 'border-b-2 border-brand-500 text-[var(--nc-ink)]'
                      : 'text-[var(--nc-muted)]'
                  }`}
                  data-testid={`spatial-tab-${t.id}`}
                  onClick={() => setRightTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 text-sm">
              {rightTab === 'objects' ? (
                <ul className="space-y-0.5" data-testid="spatial-outliner">
                  {objectTree.length === 0 ? (
                    <li className="text-xs text-[var(--nc-muted)]">Нет объектов</li>
                  ) : (
                    objectTree.map((o) => (
                      <li key={o.id}>
                        <button
                          type="button"
                          className={`w-full rounded px-2 py-1.5 text-left text-xs hover:bg-[var(--nc-surface-hover)] ${
                            selectedId === o.id ? 'bg-signal-soft text-[var(--nc-ink)]' : ''
                          }`}
                          onClick={() => {
                            setSelectedId(o.id)
                            setRightTab('props')
                          }}
                        >
                          <span className="font-medium">{o.name || layoutKindLabel(o.kind)}</span>
                          <span className="mt-0.5 block font-mono text-[10px] text-[var(--nc-faint)]">
                            {o.kind} · {o.id}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}

              {rightTab === 'props' ? (
                selected ? (
                  <div className="space-y-2" data-testid="spatial-props">
                    <p className="font-mono text-[10px] text-[var(--nc-faint)]">ID: {selected.id}</p>
                    <Input
                      label="Название"
                      disabled={readOnly}
                      value={selected.name}
                      onChange={(e) => patchObject(selected.id, { name: e.target.value })}
                    />
                    <Select
                      label="Тип"
                      disabled={readOnly || selected.id === 'wall_contour'}
                      value={selected.kind}
                      options={LAYOUT_KIND_OPTIONS.map((k) => ({ value: k.value, label: k.label }))}
                      onChange={(e) => patchObject(selected.id, { kind: e.target.value })}
                    />
                    <Input
                      label="X, м"
                      type="number"
                      step={snapEnabled ? String(gridStepM) : '0.1'}
                      disabled={readOnly}
                      value={String(selected.x)}
                      data-testid="spatial-x-input"
                      onChange={(e) => patchObject(selected.id, { x: Number(e.target.value) })}
                      onBlur={(e) =>
                        commitNumericPosition(selected.id, Number(e.target.value), selected.y)
                      }
                    />
                    <Input
                      label="Y, м"
                      type="number"
                      step={snapEnabled ? String(gridStepM) : '0.1'}
                      disabled={readOnly}
                      value={String(selected.y)}
                      data-testid="spatial-y-input"
                      onChange={(e) => patchObject(selected.id, { y: Number(e.target.value) })}
                      onBlur={(e) =>
                        commitNumericPosition(selected.id, selected.x, Number(e.target.value))
                      }
                    />
                    <Input
                      label="Ширина, м"
                      type="number"
                      step="0.1"
                      disabled={readOnly}
                      value={String(selected.width)}
                      onChange={(e) =>
                        patchObject(selected.id, { width: Math.max(0.2, Number(e.target.value)) })
                      }
                    />
                    <Input
                      label="Длина, м"
                      type="number"
                      step="0.1"
                      disabled={readOnly}
                      value={String(selected.height)}
                      onChange={(e) =>
                        patchObject(selected.id, { height: Math.max(0.2, Number(e.target.value)) })
                      }
                    />
                    <Input
                      label="Поворот, °"
                      type="number"
                      step={snapEnabled ? String(rotationStepDeg) : '1'}
                      disabled={readOnly}
                      value={String(selected.rotation || 0)}
                      data-testid="spatial-rotation-input"
                      onChange={(e) =>
                        patchObject(selected.id, { rotation: Number(e.target.value) || 0 })
                      }
                      onBlur={(e) =>
                        commitNumericRotation(selected.id, Number(e.target.value) || 0)
                      }
                    />
                    <p className="text-[11px] text-[var(--nc-muted)]">
                      Move / Rotate — манипулятор по полу / вокруг вертикали. Габариты — только
                      числовыми полями. Multi-select не включён (модель выделения одиночная).
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--nc-muted)]">Выберите объект на сцене или в списке.</p>
                )
              ) : null}

              {rightTab === 'scene' ? (
                <div className="space-y-3" data-testid="spatial-scene-settings">
                  <p className="text-xs text-[var(--nc-muted)]">
                    Помещение: {layout.width_m} × {layout.length_m} м · объектов: {objectTree.length}
                  </p>
                  <fieldset className="space-y-2">
                    <legend className="text-xs font-medium">Привязка</legend>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={snapEnabled}
                        data-testid="spatial-snap-toggle"
                        onChange={(e) => setSnapEnabled(e.target.checked)}
                      />
                      Привязка к сетке
                    </label>
                    <Input
                      label="Шаг сетки, м"
                      type="number"
                      step="0.1"
                      min={0.05}
                      disabled={readOnly}
                      value={String(gridStepM)}
                      data-testid="spatial-grid-step"
                      onChange={(e) =>
                        setGridStepM(Math.max(0.05, Number(e.target.value) || 0.5))
                      }
                    />
                    <Input
                      label="Шаг угла, °"
                      type="number"
                      step="1"
                      min={1}
                      disabled={readOnly}
                      value={String(rotationStepDeg)}
                      data-testid="spatial-rotation-step"
                      onChange={(e) =>
                        setRotationStepDeg(Math.max(1, Number(e.target.value) || 15))
                      }
                    />
                    <p className="text-[11px] text-[var(--nc-muted)]">
                      Включение snap не сдвигает уже стоящие объекты — только новые commit
                      перемещения / угла / blur числовых полей.
                    </p>
                  </fieldset>
                  <fieldset className="space-y-1.5">
                    <legend className="text-xs font-medium">Слои</legend>
                    {(
                      [
                        ['grid', 'Сетка'],
                        ['equipment', 'Стеллажи'],
                        ['obstacles', 'Препятствия'],
                        ['zones', 'Зоны'],
                        ['routes', 'Маршруты'],
                        ['labels', 'Подписи'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={layers[key]}
                          data-testid={`spatial-layer-${key}`}
                          onChange={(e) => setLayers({ ...layers, [key]: e.target.checked })}
                        />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                  <p className="text-[11px] text-[var(--nc-muted)]">
                    Маршруты — из сохранённой планировки. Live-позиции DES в Studio не
                    отображаются: API simulation отдаёт статичный конфиг, не поток поз (см.
                    docs/NETCORE_SPATIAL_STUDIO.md).
                  </p>
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>

      {/* Status bar */}
      <footer
        className="flex h-7 shrink-0 items-center gap-3 border-t border-[var(--nc-border)] bg-[var(--nc-surface-muted)] px-3 text-[11px] text-[var(--nc-muted)]"
        data-testid="spatial-statusbar"
      >
        <span>
          Инструмент:{' '}
          {tool === 'select' ? 'выбор' : tool === 'move' ? 'перемещение' : 'вращение'}
        </span>
        <span aria-hidden>·</span>
        <span className="truncate">
          {selected
            ? `${selected.name || selected.kind} (${selected.id})`
            : 'ничего не выбрано'}
        </span>
        <span aria-hidden>·</span>
        <span>{statusLabel(saveStatus)}</span>
        <span aria-hidden>·</span>
        <span data-testid="spatial-snap-status">
          Snap: {snapEnabled ? `${gridStepM} м / ${rotationStepDeg}°` : 'выкл'}
        </span>
        <span className="ml-auto hidden sm:inline">
          ЛКМ — выбор · колёсико — zoom к курсору · ПКМ — орбита · средняя — pan · Move/Rotate —
          манипулятор
        </span>
      </footer>
    </div>
  )
}

/** Ссылка из планировщика (не используем default export для tree-shake). */
export function SpatialStudioEntryLink({ projectId }: { projectId: string }) {
  return (
    <Link
      to={`/app/projects/${projectId}/spatial`}
      className="nc-focusable inline-flex h-8 items-center gap-1.5 rounded border border-[var(--nc-border-strong)] bg-[var(--nc-surface)] px-2.5 text-sm font-medium text-[var(--nc-ink)] hover:border-brand-500/50"
      data-testid="spatial-studio-open"
    >
      Spatial Studio
    </Link>
  )
}
