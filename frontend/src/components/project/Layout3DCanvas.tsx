import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import type { WarehouseLayout } from '../../types'
import {
  fitCameraPosition,
  warehouseMetersToScene,
} from '../../utils/sceneCoords'
import { useThemeStore } from '../../store/themeStore'

interface Props {
  layout: WarehouseLayout
  selectedId?: string | null
  onSelectId?: (id: string | null) => void
}

const KIND_COLOR: Record<string, string> = {
  rack: '#8fa3b8',
  obstacle: '#fca5a5',
  wall: '#94a3b8',
  zone: '#e2e8f0',
  charge: '#86efac',
  load: '#fdba74',
  unload: '#93c5fd',
  start: '#c4b5fd',
}

function Scene({ layout, selectedId, onSelectId, floor, grid, bg }: Props & { floor: string; grid: string; bg: string }) {
  const extents = { widthM: layout.width_m, lengthM: layout.length_m }
  const span = Math.max(extents.widthM, extents.lengthM)

  return (
    <>
      <color attach="background" args={[bg]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[12, 20, 8]} intensity={1} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[extents.widthM, extents.lengthM]} />
        <meshStandardMaterial color={floor} roughness={0.9} />
      </mesh>
      <gridHelper args={[span, Math.max(8, Math.round(span)), grid, grid]} position={[0, 0.02, 0]} />

      {layout.objects
        .filter((o) => o.id !== 'wall_contour')
        .map((o) => {
          const cx = o.x + o.width / 2
          const cy = o.y + o.height / 2
          const s = warehouseMetersToScene(layout, cx, cy)
          const rot = ((o.rotation || 0) * Math.PI) / 180
          const kind = o.kind || 'zone'
          const selected = o.id === selectedId
          const isVolume = kind === 'rack' || kind === 'obstacle' || kind === 'wall'
          const h = kind === 'rack' ? 2.2 : kind === 'wall' || kind === 'obstacle' ? 2.4 : 0.06
          return (
            <group
              key={o.id}
              position={[s.x, isVolume ? h / 2 : 0.03, s.z]}
              rotation={[0, -rot, 0]}
              onClick={(e) => {
                e.stopPropagation()
                onSelectId?.(o.id)
              }}
            >
              <mesh>
                <boxGeometry args={[Math.max(0.1, o.width), isVolume ? h : 0.06, Math.max(0.1, o.height)]} />
                <meshStandardMaterial
                  color={KIND_COLOR[kind] || '#cbd5e1'}
                  transparent={!isVolume}
                  opacity={isVolume ? 1 : 0.85}
                  emissive={selected ? '#f07316' : '#000000'}
                  emissiveIntensity={selected ? 0.35 : 0}
                />
              </mesh>
              {selected && (
                <Text position={[0, (isVolume ? h / 2 : 0.03) + 0.4, 0]} fontSize={0.35} color="#f07316" anchorX="center">
                  {o.name || kind}
                </Text>
              )}
            </group>
          )
        })}

      {(layout.routes || []).map((r) => {
        const pts = (r.points || []).map((p) => {
          const s = warehouseMetersToScene(layout, p.x, p.y)
          return [s.x, 0.1, s.z] as [number, number, number]
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
                <mesh key={i} position={[mx, 0.1, mz]} rotation={[0, ang, 0]}>
                  <boxGeometry args={[0.12, 0.06, Math.max(0.05, len)]} />
                  <meshStandardMaterial color="#f07316" />
                </mesh>
              )
            })}
          </group>
        )
      })}

      <OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI / 2.05} />
    </>
  )
}

export function Layout3DCanvas({ layout, selectedId, onSelectId }: Props) {
  const theme = useThemeStore((s) => s.theme)
  const colors = useMemo(
    () =>
      theme === 'light'
        ? { bg: '#e8ebf0', floor: '#d9dde3', grid: '#a8b2c1' }
        : { bg: '#121826', floor: '#1c2433', grid: '#3d4a60' },
    [theme],
  )
  const cam = fitCameraPosition({ widthM: layout.width_m, lengthM: layout.length_m })

  return (
    <div
      className="h-[min(56vh,480px)] min-h-[320px] w-full overflow-hidden rounded border border-[var(--nc-border)]"
      style={{ background: colors.bg }}
      data-testid="layout-3d-canvas"
    >
      <Canvas camera={{ position: cam.position, fov: 42 }} dpr={[1, 1.5]}>
        <Scene
          layout={layout}
          selectedId={selectedId}
          onSelectId={onSelectId}
          floor={colors.floor}
          grid={colors.grid}
          bg={colors.bg}
        />
      </Canvas>
    </div>
  )
}
