/**
 * Пространственная сцена WarehouseLayout (метры).
 * Редактирование геометрии — в 2D; здесь просмотр, выбор и синхронизация selectedId.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import type { WarehouseLayout, LayoutObject } from '../../types'
import {
  fitCameraPosition,
  warehouseMetersToScene,
  warehouseRoomExtents,
  type CameraFitResult,
} from '../../utils/sceneCoords'
import { useThemeStore } from '../../store/themeStore'

export type Layout3DLayer =
  | 'grid'
  | 'equipment'
  | 'obstacles'
  | 'zones'
  | 'routes'
  | 'labels'

export type Layout3DLayers = Record<Layout3DLayer, boolean>

export const DEFAULT_LAYOUT_3D_LAYERS: Layout3DLayers = {
  grid: true,
  equipment: true,
  obstacles: true,
  zones: true,
  routes: true,
  labels: true,
}

interface Props {
  layout: WarehouseLayout
  selectedId?: string | null
  onSelectId?: (id: string | null) => void
  /** Инкремент — пересчёт «весь склад» с учётом текущего aspect. */
  fitNonce?: number
  cameraMode?: 'iso' | 'top'
  layers?: Layout3DLayers
}

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

/** Только визуальная высота — не пишется в DTO. */
function visualHeight(kind: string): number {
  if (kind === 'rack') return 2.4
  if (kind === 'wall' || kind === 'obstacle') return 2.2
  if (kind === 'charge') return 0.55
  return 0.04
}

function isZoneKind(kind: string) {
  return kind === 'zone' || kind === 'load' || kind === 'unload' || kind === 'charge' || kind === 'start'
}

function isEquipment(kind: string) {
  return kind === 'rack'
}

type OrbitLike = { target: { set: (x: number, y: number, z: number) => void }; update: () => void }

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
  const applied = useRef<string>('')

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
}: {
  widthM: number
  lengthM: number
  floor: string
  wall: string
  grid: string
  showGrid: boolean
}) {
  const wallH = 2.8
  const t = 0.18
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[widthM, lengthM]} />
        <meshStandardMaterial color={floor} roughness={0.92} metalness={0.04} />
      </mesh>
      {/* Контур помещения — низкий бортик + стены по периметру */}
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
          <meshStandardMaterial color={wall} roughness={0.85} transparent opacity={0.55} />
        </mesh>
      ))}
      {showGrid ? (
        <gridHelper
          args={[Math.max(widthM, lengthM), Math.max(4, Math.round(Math.max(widthM, lengthM) / 5)), grid, grid]}
          position={[0, 0.015, 0]}
        />
      ) : null}
    </group>
  )
}

function RackMesh({
  o,
  layout,
  selected,
  showLabel,
  onSelect,
}: {
  o: LayoutObject
  layout: WarehouseLayout
  selected: boolean
  showLabel: boolean
  onSelect: () => void
}) {
  const cx = o.x + o.width / 2
  const cy = o.y + o.height / 2
  const s = warehouseMetersToScene(layout, cx, cy)
  const rot = ((o.rotation || 0) * Math.PI) / 180
  const sx = Math.max(0.15, o.width)
  const sz = Math.max(0.15, o.height)
  const h = visualHeight('rack')
  const posts: [number, number][] = [
    [-sx / 2 + 0.07, -sz / 2 + 0.07],
    [sx / 2 - 0.07, -sz / 2 + 0.07],
    [-sx / 2 + 0.07, sz / 2 - 0.07],
    [sx / 2 - 0.07, sz / 2 - 0.07],
  ]
  const shelves = [0.4, 1.1, 1.8]

  return (
    <group
      position={[s.x, 0, s.z]}
      rotation={[0, -rot, 0]}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      {posts.map(([px, pz], i) => (
        <mesh key={i} position={[px, h / 2, pz]} castShadow>
          <boxGeometry args={[0.09, h, 0.09]} />
          <meshStandardMaterial color={selected ? '#c45a12' : '#5c6b7a'} roughness={0.65} />
        </mesh>
      ))}
      {shelves.map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow receiveShadow>
          <boxGeometry args={[sx - 0.04, 0.07, sz - 0.04]} />
          <meshStandardMaterial
            color={selected ? '#e8a06a' : KIND_COLOR.rack}
            roughness={0.72}
            emissive={selected ? '#f07316' : '#000000'}
            emissiveIntensity={selected ? 0.22 : 0}
          />
        </mesh>
      ))}
      {showLabel && selected ? (
        <Text position={[0, h + 0.35, 0]} fontSize={0.32} color="#f07316" anchorX="center">
          {o.name || 'Стеллаж'}
        </Text>
      ) : null}
    </group>
  )
}

function GenericObject({
  o,
  layout,
  selected,
  showLabel,
  onSelect,
}: {
  o: LayoutObject
  layout: WarehouseLayout
  selected: boolean
  showLabel: boolean
  onSelect: () => void
}) {
  const kind = o.kind || 'zone'
  const cx = o.x + o.width / 2
  const cy = o.y + o.height / 2
  const s = warehouseMetersToScene(layout, cx, cy)
  const rot = ((o.rotation || 0) * Math.PI) / 180
  const h = visualHeight(kind)
  const isVol = kind === 'obstacle' || kind === 'wall' || kind === 'charge'
  const sx = Math.max(0.1, o.width)
  const sz = Math.max(0.1, o.height)

  return (
    <group
      position={[s.x, isVol ? h / 2 : 0.02, s.z]}
      rotation={[0, -rot, 0]}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      <mesh>
        <boxGeometry args={[sx, isVol ? h : 0.05, sz]} />
        <meshStandardMaterial
          color={KIND_COLOR[kind] || '#a8b2c0'}
          transparent={!isVol}
          opacity={isVol ? 0.92 : 0.88}
          roughness={0.8}
          emissive={selected ? '#f07316' : '#000000'}
          emissiveIntensity={selected ? 0.28 : 0}
        />
      </mesh>
      {kind === 'start' || kind === 'charge' ? (
        <mesh position={[0, isVol ? h / 2 + 0.08 : 0.12, Math.min(sz, sx) * 0.15]}>
          <boxGeometry args={[Math.min(0.45, sx * 0.4), 0.04, 0.06]} />
          <meshStandardMaterial color="#f07316" emissive="#f07316" emissiveIntensity={0.4} />
        </mesh>
      ) : null}
      {showLabel && selected ? (
        <Text position={[0, (isVol ? h / 2 : 0.05) + 0.4, 0]} fontSize={0.3} color="#f07316" anchorX="center">
          {o.name || kind}
        </Text>
      ) : null}
    </group>
  )
}

function SceneContent({
  layout,
  selectedId,
  onSelectId,
  layers,
  fit,
  fitNonce,
  floor,
  wall,
  grid,
  bg,
}: Props & {
  layers: Layout3DLayers
  fit: CameraFitResult
  fitNonce: number
  floor: string
  wall: string
  grid: string
  bg: string
}) {
  const controlsRef = useRef<OrbitLike | null>(null)
  const extents = warehouseRoomExtents(layout)

  return (
    <>
      <color attach="background" args={[bg]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[18, 28, 12]} intensity={1.05} castShadow={false} />
      <hemisphereLight args={['#dfe6f0', '#2a3038', 0.35]} />

      <CameraRig fit={fit} fitNonce={fitNonce} controlsRef={controlsRef} />

      <RoomShell
        widthM={extents.widthM}
        lengthM={extents.lengthM}
        floor={floor}
        wall={wall}
        grid={grid}
        showGrid={layers.grid}
      />

      {layout.objects
        .filter((o) => o.id !== 'wall_contour')
        .map((o) => {
          const kind = o.kind || 'zone'
          if (isEquipment(kind) && !layers.equipment) return null
          if (kind === 'obstacle' && !layers.obstacles) return null
          if (isZoneKind(kind) && !layers.zones) return null
          if (kind === 'wall' && !layers.obstacles) return null
          if (isEquipment(kind)) {
            return (
              <RackMesh
                key={o.id}
                o={o}
                layout={layout}
                selected={o.id === selectedId}
                showLabel={layers.labels}
                onSelect={() => onSelectId?.(o.id)}
              />
            )
          }
          return (
            <GenericObject
              key={o.id}
              o={o}
              layout={layout}
              selected={o.id === selectedId}
              showLabel={layers.labels}
              onSelect={() => onSelectId?.(o.id)}
            />
          )
        })}

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
                      <meshStandardMaterial color="#f07316" roughness={0.45} />
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
        onClick={() => onSelectId?.(null)}
      >
        <planeGeometry args={[extents.widthM, extents.lengthM]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <OrbitControls
        // drei OrbitControls typings ≠ наш OrbitLike; runtime совместим (target/update)
        ref={controlsRef as never}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.02}
        minDistance={2}
        maxDistance={Math.max(extents.widthM, extents.lengthM) * 8}
      />
    </>
  )
}

export function Layout3DCanvas({
  layout,
  selectedId,
  onSelectId,
  fitNonce = 0,
  cameraMode = 'iso',
  layers = DEFAULT_LAYOUT_3D_LAYERS,
}: Props) {
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
        ? { bg: '#e4e8ee', floor: '#d5dbe3', wall: '#9aa5b4', grid: '#b7c0cc' }
        : { bg: '#0f141c', floor: '#1a222e', wall: '#3a4658', grid: '#2e3a4c' },
    [theme],
  )

  const extents = warehouseRoomExtents(layout)
  const fit = useMemo(
    () =>
      fitCameraPosition(extents, {
        fovDeg: FOV,
        aspect,
        padding: 1.22,
        mode: cameraMode,
      }),
    [extents.widthM, extents.lengthM, aspect, cameraMode],
  )

  return (
    <div
      ref={wrapRef}
      className="h-full min-h-[420px] w-full overflow-hidden rounded border border-[var(--nc-border)]"
      style={{ background: colors.bg }}
      data-testid="layout-3d-canvas"
    >
      <Canvas
        camera={{ position: fit.position, fov: FOV, near: fit.near, far: fit.far }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.setClearColor(colors.bg)
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <SceneContent
          layout={layout}
          selectedId={selectedId}
          onSelectId={onSelectId}
          layers={layers}
          fit={fit}
          fitNonce={fitNonce}
          floor={colors.floor}
          wall={colors.wall}
          grid={colors.grid}
          bg={colors.bg}
        />
      </Canvas>
    </div>
  )
}
