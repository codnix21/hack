/**
 * Полноэкранная сцена Spatial Studio.
 * Правки через TransformControls → патч WarehouseLayout (метры).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Text, TransformControls } from '@react-three/drei'
import type { Group } from 'three'
import type { WarehouseLayout, LayoutObject } from '../../types'
import {
  fitCameraPosition,
  warehouseMetersToScene,
  warehouseRoomExtents,
  type CameraFitResult,
} from '../../utils/sceneCoords'
import { useThemeStore } from '../../store/themeStore'
import {
  DEFAULT_LAYOUT_3D_LAYERS,
  type Layout3DLayers,
} from '../project/Layout3DCanvas'
import type { SpatialTool } from './layoutKinds'
import {
  commitMoveFromScene,
  commitRotateFromSceneY,
  type TransformCommitOpts,
} from './spatialMath'

const FOV = 42

const KIND_COLOR: Record<string, string> = {
  rack: '#7d8fa3',
  obstacle: '#c48484',
  wall: '#8b95a5',
  zone: '#c5ccd6',
  charge: '#6faf87',
  load: '#d4a06a',
  unload: '#7aa3c4',
  start: '#9b8fc4',
}

function visualHeight(kind: string): number {
  if (kind === 'rack') return 2.4
  if (kind === 'wall' || kind === 'obstacle') return 2.2
  if (kind === 'charge') return 0.55
  return 0.04
}

type OrbitLike = {
  target: { set: (x: number, y: number, z: number) => void }
  update: () => void
  enabled: boolean
}

function CameraRig({
  fit,
  fitNonce,
  controlsRef,
}: {
  fit: CameraFitResult
  fitNonce: number
  controlsRef: RefObject<OrbitLike | null>
}) {
  const { camera, size } = useThree()
  const applied = useRef('')
  useLayoutEffect(() => {
    const key = `${fitNonce}|${fit.position.join(',')}|${size.width}x${size.height}`
    if (applied.current === key) return
    applied.current = key
    camera.position.set(...fit.position)
    camera.near = fit.near
    camera.far = fit.far
    camera.updateProjectionMatrix()
    const ctrl = controlsRef.current
    if (ctrl) {
      ctrl.target.set(...fit.target)
      ctrl.update()
    }
  }, [camera, fit, fitNonce, size.width, size.height, controlsRef])
  return null
}

function RoomShell({
  widthM,
  lengthM,
  floor,
  wall,
  grid,
  showGrid,
  gridStepM,
}: {
  widthM: number
  lengthM: number
  floor: string
  wall: string
  grid: string
  showGrid: boolean
  gridStepM: number
}) {
  const wallH = 2.8
  const t = 0.18
  const step = Math.max(0.25, gridStepM)
  const divisions = Math.max(2, Math.round(Math.max(widthM, lengthM) / step))
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[widthM, lengthM]} />
        <meshStandardMaterial color={floor} roughness={0.92} metalness={0.04} />
      </mesh>
      {(
        [
          [0, wallH / 2, -lengthM / 2, widthM + t, wallH, t],
          [0, wallH / 2, lengthM / 2, widthM + t, wallH, t],
          [-widthM / 2, wallH / 2, 0, t, wallH, lengthM],
          [widthM / 2, wallH / 2, 0, t, wallH, lengthM],
        ] as const
      ).map(([x, y, z, sx, sy, sz], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[sx, sy, sz]} />
          <meshStandardMaterial color={wall} roughness={0.85} transparent opacity={0.5} />
        </mesh>
      ))}
      {showGrid ? (
        <gridHelper
          args={[Math.max(widthM, lengthM), divisions, grid, grid]}
          position={[0, 0.015, 0]}
        />
      ) : null}
    </group>
  )
}

function ObjectMesh({
  o,
  layout,
  selected,
  showLabel,
  groupRef,
  onSelect,
  draggingRef,
}: {
  o: LayoutObject
  layout: WarehouseLayout
  selected: boolean
  showLabel: boolean
  groupRef?: (node: Group | null) => void
  onSelect: () => void
  draggingRef: RefObject<boolean>
}) {
  const kind = o.kind || 'zone'
  const cx = o.x + o.width / 2
  const cy = o.y + o.height / 2
  const s = warehouseMetersToScene(layout, cx, cy)
  const rot = ((o.rotation || 0) * Math.PI) / 180
  const h = visualHeight(kind)
  const isRack = kind === 'rack'
  const isVol = isRack || kind === 'obstacle' || kind === 'wall' || kind === 'charge'
  const sx = Math.max(0.1, o.width)
  const sz = Math.max(0.1, o.height)
  const localRef = useRef<Group | null>(null)

  const setRefs = (node: Group | null) => {
    localRef.current = node
    groupRef?.(node)
  }

  // Синхронизация из DTO только когда нет активного drag — без скачка после commit.
  useLayoutEffect(() => {
    const g = localRef.current
    if (!g || draggingRef.current) return
    g.position.set(s.x, 0, s.z)
    g.rotation.set(0, -rot, 0)
  }, [s.x, s.z, rot, draggingRef])

  return (
    <group
      ref={setRefs}
      position={[s.x, 0, s.z]}
      rotation={[0, -rot, 0]}
      userData={{ objectId: o.id }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      {isRack ? (
        <>
          {(
            [
              [-sx / 2 + 0.07, -sz / 2 + 0.07],
              [sx / 2 - 0.07, -sz / 2 + 0.07],
              [-sx / 2 + 0.07, sz / 2 - 0.07],
              [sx / 2 - 0.07, sz / 2 - 0.07],
            ] as const
          ).map(([px, pz], i) => (
            <mesh key={i} position={[px, h / 2, pz]}>
              <boxGeometry args={[0.09, h, 0.09]} />
              <meshStandardMaterial color={selected ? '#c45a12' : '#5c6b7a'} />
            </mesh>
          ))}
          {[0.4, 1.1, 1.8].map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <boxGeometry args={[sx - 0.04, 0.07, sz - 0.04]} />
              <meshStandardMaterial
                color={selected ? '#e8a06a' : KIND_COLOR.rack}
                emissive={selected ? '#f07316' : '#000000'}
                emissiveIntensity={selected ? 0.2 : 0}
              />
            </mesh>
          ))}
        </>
      ) : (
        <mesh position={[0, isVol ? h / 2 : 0.03, 0]}>
          <boxGeometry args={[sx, isVol ? h : 0.05, sz]} />
          <meshStandardMaterial
            color={KIND_COLOR[kind] || '#a8b2c0'}
            transparent={!isVol}
            opacity={isVol ? 0.92 : 0.88}
            emissive={selected ? '#f07316' : '#000000'}
            emissiveIntensity={selected ? 0.25 : 0}
          />
        </mesh>
      )}
      {showLabel && selected ? (
        <Text position={[0, h + 0.35, 0]} fontSize={0.32} color="#f07316" anchorX="center">
          {o.name || kind}
        </Text>
      ) : null}
    </group>
  )
}

function EditableObject({
  o,
  layout,
  selected,
  tool,
  editEnabled,
  showLabel,
  snapOpts,
  onSelect,
  onCommitTransform,
}: {
  o: LayoutObject
  layout: WarehouseLayout
  selected: boolean
  tool: SpatialTool
  editEnabled: boolean
  showLabel: boolean
  snapOpts: TransformCommitOpts
  onSelect: () => void
  onCommitTransform: (id: string, patch: Partial<LayoutObject>) => void
}) {
  const [group, setGroup] = useState<Group | null>(null)
  const orbit = useThree((s) => s.controls) as OrbitLike | null
  const draggingRef = useRef(false)

  const showGizmo =
    editEnabled && selected && o.id !== 'wall_contour' && (tool === 'move' || tool === 'rotate') && group

  const translationSnap = snapOpts.snapEnabled ? snapOpts.gridStepM : null
  const rotationSnap = snapOpts.snapEnabled
    ? (snapOpts.rotationStepDeg * Math.PI) / 180
    : null

  return (
    <>
      <ObjectMesh
        o={o}
        layout={layout}
        selected={selected}
        showLabel={showLabel}
        groupRef={setGroup}
        onSelect={onSelect}
        draggingRef={draggingRef}
      />
      {showGizmo ? (
        <TransformControls
          object={group}
          mode={tool === 'rotate' ? 'rotate' : 'translate'}
          showX={tool === 'move' || tool === 'rotate'}
          showY={tool === 'rotate'}
          showZ={tool === 'move' || tool === 'rotate'}
          translationSnap={translationSnap}
          rotationSnap={rotationSnap}
          onMouseDown={() => {
            draggingRef.current = true
            if (orbit) orbit.enabled = false
          }}
          onMouseUp={() => {
            if (orbit) orbit.enabled = true
            if (!group) {
              draggingRef.current = false
              return
            }
            // Пол: Y всегда 0; габариты не трогаем.
            group.position.y = 0
            group.rotation.x = 0
            group.rotation.z = 0
            if (tool === 'move') {
              const pos = commitMoveFromScene(
                layout,
                o,
                group.position.x,
                group.position.z,
                snapOpts,
              )
              // Синхронизируем mesh до React-коммита — без скачка.
              const s = warehouseMetersToScene(layout, pos.x + o.width / 2, pos.y + o.height / 2)
              group.position.set(s.x, 0, s.z)
              draggingRef.current = false
              onCommitTransform(o.id, { x: pos.x, y: pos.y })
            } else {
              const rotation = commitRotateFromSceneY(group.rotation.y, snapOpts)
              group.rotation.set(0, -((rotation * Math.PI) / 180), 0)
              draggingRef.current = false
              onCommitTransform(o.id, { rotation })
            }
          }}
        />
      ) : null}
    </>
  )
}

function SceneBody({
  layout,
  selectedId,
  onSelectId,
  layers,
  fit,
  fitNonce,
  tool,
  editEnabled,
  snapOpts,
  onCommitTransform,
  floor,
  wall,
  grid,
  bg,
}: {
  layout: WarehouseLayout
  selectedId: string | null
  onSelectId: (id: string | null) => void
  layers: Layout3DLayers
  fit: CameraFitResult
  fitNonce: number
  tool: SpatialTool
  editEnabled: boolean
  snapOpts: TransformCommitOpts
  onCommitTransform: (id: string, patch: Partial<LayoutObject>) => void
  floor: string
  wall: string
  grid: string
  bg: string
}) {
  const controlsRef = useRef<OrbitLike | null>(null)
  const extents = warehouseRoomExtents(layout)

  const visibleObjects = layout.objects.filter((o) => {
    if (o.id === 'wall_contour') return false
    const kind = o.kind || 'zone'
    if (kind === 'rack' && !layers.equipment) return false
    if ((kind === 'obstacle' || kind === 'wall') && !layers.obstacles) return false
    if (['zone', 'load', 'unload', 'charge', 'start'].includes(kind) && !layers.zones) return false
    return true
  })

  return (
    <>
      <color attach="background" args={[bg]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[18, 28, 12]} intensity={1.05} />
      <hemisphereLight args={['#dfe6f0', '#2a3038', 0.35]} />
      <CameraRig fit={fit} fitNonce={fitNonce} controlsRef={controlsRef} />
      <RoomShell
        widthM={extents.widthM}
        lengthM={extents.lengthM}
        floor={floor}
        wall={wall}
        grid={grid}
        showGrid={layers.grid}
        gridStepM={snapOpts.gridStepM}
      />
      {visibleObjects.map((o) => (
        <EditableObject
          key={o.id}
          o={o}
          layout={layout}
          selected={o.id === selectedId}
          tool={tool}
          editEnabled={editEnabled}
          showLabel={layers.labels}
          snapOpts={snapOpts}
          onSelect={() => onSelectId(o.id)}
          onCommitTransform={onCommitTransform}
        />
      ))}
      {layers.routes
        ? (layout.routes || []).map((r) => {
            const pts = (r.points || []).map((p) => {
              const s = warehouseMetersToScene(layout, p.x, p.y)
              return [s.x, 0.12, s.z] as [number, number, number]
            })
            if (pts.length < 2) return null
            return (
              <group key={r.id}>
                {pts.slice(0, -1).map((a, i) => {
                  const b = pts[i + 1]
                  const mx = (a[0] + b[0]) / 2
                  const mz = (a[2] + b[2]) / 2
                  const dx = b[0] - a[0]
                  const dz = b[2] - a[2]
                  const len = Math.hypot(dx, dz)
                  const ang = Math.atan2(dx, dz)
                  return (
                    <mesh key={i} position={[mx, 0.12, mz]} rotation={[0, ang, 0]}>
                      <boxGeometry args={[0.14, 0.05, Math.max(0.05, len)]} />
                      <meshStandardMaterial color="#f07316" />
                    </mesh>
                  )
                })}
              </group>
            )
          })
        : null}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
        onClick={() => onSelectId(null)}
      >
        <planeGeometry args={[extents.widthM, extents.lengthM]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      <OrbitControls
        ref={controlsRef as never}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan
        screenSpacePanning
        zoomToCursor
        maxPolarAngle={Math.PI / 2.02}
        minDistance={2}
        maxDistance={Math.max(extents.widthM, extents.lengthM) * 8}
      />
    </>
  )
}

export interface SpatialSceneCanvasProps {
  layout: WarehouseLayout
  selectedId: string | null
  onSelectId: (id: string | null) => void
  tool: SpatialTool
  editEnabled: boolean
  onCommitTransform: (id: string, patch: Partial<LayoutObject>) => void
  fitNonce: number
  cameraMode: 'iso' | 'top'
  layers?: Layout3DLayers
  snapEnabled?: boolean
  gridStepM?: number
  rotationStepDeg?: number
}

export function SpatialSceneCanvas({
  layout,
  selectedId,
  onSelectId,
  tool,
  editEnabled,
  onCommitTransform,
  fitNonce,
  cameraMode,
  layers = DEFAULT_LAYOUT_3D_LAYERS,
  snapEnabled = false,
  gridStepM = 0.5,
  rotationStepDeg = 15,
}: SpatialSceneCanvasProps) {
  const theme = useThemeStore((s) => s.theme)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [aspect, setAspect] = useState(16 / 9)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w > 0 && h > 0) setAspect(w / h)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const colors = useMemo(
    () =>
      theme === 'light'
        ? { bg: '#dfe3e9', floor: '#cfd6df', wall: '#8e99a8', grid: '#aeb6c2' }
        : { bg: '#0c1016', floor: '#151c26', wall: '#3a4658', grid: '#2a3545' },
    [theme],
  )

  const snapOpts = useMemo<TransformCommitOpts>(
    () => ({
      snapEnabled,
      gridStepM: Math.max(0.05, gridStepM),
      rotationStepDeg: Math.max(1, rotationStepDeg),
    }),
    [snapEnabled, gridStepM, rotationStepDeg],
  )

  const extents = warehouseRoomExtents(layout)
  const fit = useMemo(
    () =>
      fitCameraPosition(extents, {
        fovDeg: FOV,
        aspect,
        padding: 1.2,
        mode: cameraMode,
      }),
    [extents.widthM, extents.lengthM, aspect, cameraMode],
  )

  return (
    <div
      ref={wrapRef}
      className="h-full w-full"
      style={{ background: colors.bg }}
      data-testid="spatial-scene-canvas"
    >
      <Canvas
        camera={{ position: fit.position, fov: FOV, near: fit.near, far: fit.far }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        style={{ width: '100%', height: '100%' }}
        onCreated={({ gl }) => {
          const onContextLost = (e: Event) => e.preventDefault()
          gl.domElement.addEventListener('webglcontextlost', onContextLost)
        }}
      >
        <SceneBody
          layout={layout}
          selectedId={selectedId}
          onSelectId={onSelectId}
          layers={layers}
          fit={fit}
          fitNonce={fitNonce}
          tool={tool}
          editEnabled={editEnabled}
          snapOpts={snapOpts}
          onCommitTransform={onCommitTransform}
          floor={colors.floor}
          wall={colors.wall}
          grid={colors.grid}
          bg={colors.bg}
        />
      </Canvas>
    </div>
  )
}
