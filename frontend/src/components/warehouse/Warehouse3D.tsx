import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import * as THREE from 'three'
import type { VisualizationLayout } from '../../types'
import type { LayerFlags, SimRobot, SimCollision } from '../../simulation/types'
import { STATUS_COLOR } from '../../simulation/types'

interface Props {
  layout: VisualizationLayout
  robots: SimRobot[]
  collisions: SimCollision[]
  layers: LayerFlags
  selectedRobotId: string | null
  onSelectRobot: (id: string | null) => void
  followRobot: boolean
  cameraPreset: 'top' | 'iso' | 'side' | 'reset'
  onCameraApplied: () => void
}

function toScene(layout: VisualizationLayout, x: number, y: number) {
  const w = layout.width || 800
  const h = layout.height || 500
  return {
    x: (x / w) * 40 - 20,
    z: (y / h) * 28 - 14,
  }
}

function Floor() {
  const w = 40
  const d = 28
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#d9dde3" roughness={0.92} metalness={0.05} />
      </mesh>
      <gridHelper args={[Math.max(w, d), 20, '#a8b2c1', '#e6e9ee']} position={[0, 0.015, 0]} />
      {/* perimeter curb */}
      <mesh position={[0, 0.08, -d / 2]}>
        <boxGeometry args={[w + 0.2, 0.16, 0.2]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <mesh position={[0, 0.08, d / 2]}>
        <boxGeometry args={[w + 0.2, 0.16, 0.2]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <mesh position={[-w / 2, 0.08, 0]}>
        <boxGeometry args={[0.2, 0.16, d]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <mesh position={[w / 2, 0.08, 0]}>
        <boxGeometry args={[0.2, 0.16, d]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
    </group>
  )
}

function Shelves({ layout, visible }: { layout: VisualizationLayout; visible: boolean }) {
  if (!visible) return null
  return (
    <group>
      {(layout.zones || [])
        .filter((z) => (z.type || '') === 'storage')
        .map((z) => {
          const a = toScene(layout, z.x, z.y)
          const b = toScene(layout, z.x + z.w, z.y + z.h)
          const cx = (a.x + b.x) / 2
          const cz = (a.z + b.z) / 2
          const sx = Math.max(0.55, Math.abs(b.x - a.x))
          const sz = Math.max(0.55, Math.abs(b.z - a.z))
          return (
            <group key={z.id} position={[cx, 0, cz]}>
              {/* uprights */}
              {(
                [
                  [-sx / 2 + 0.06, -sz / 2 + 0.06],
                  [sx / 2 - 0.06, -sz / 2 + 0.06],
                  [-sx / 2 + 0.06, sz / 2 - 0.06],
                  [sx / 2 - 0.06, sz / 2 - 0.06],
                ] as const
              ).map(([px, pz], i) => (
                <mesh key={i} position={[px, 1.1, pz]} castShadow>
                  <boxGeometry args={[0.08, 2.2, 0.08]} />
                  <meshStandardMaterial color="#64748b" />
                </mesh>
              ))}
              {/* shelves */}
              {[0.35, 1.05, 1.75].map((y) => (
                <mesh key={y} position={[0, y, 0]} castShadow receiveShadow>
                  <boxGeometry args={[sx, 0.08, sz]} />
                  <meshStandardMaterial color="#8fa3b8" roughness={0.7} />
                </mesh>
              ))}
              {/* back panel */}
              <mesh position={[0, 1.1, -sz / 2 + 0.04]}>
                <boxGeometry args={[sx, 2.2, 0.04]} />
                <meshStandardMaterial color="#7b8fa5" transparent opacity={0.55} />
              </mesh>
            </group>
          )
        })}
    </group>
  )
}

function Zones({ layout, visible }: { layout: VisualizationLayout; visible: boolean }) {
  if (!visible) return null
  return (
    <group>
      {(layout.zones || [])
        .filter((z) => (z.type || '') !== 'storage')
        .map((z) => {
          const a = toScene(layout, z.x, z.y)
          const b = toScene(layout, z.x + z.w, z.y + z.h)
          const cx = (a.x + b.x) / 2
          const cz = (a.z + b.z) / 2
          const sx = Math.max(0.4, Math.abs(b.x - a.x))
          const sz = Math.max(0.4, Math.abs(b.z - a.z))
          const color =
            z.type === 'load' ? '#fdba74' : z.type === 'unload' ? '#93c5fd' : '#e8ecf1'
          return (
            <mesh key={z.id} position={[cx, 0.04, cz]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[sx, sz]} />
              <meshStandardMaterial color={color} transparent opacity={0.9} />
            </mesh>
          )
        })}
      {(layout.charging_stations || []).map((p) => {
        const s = toScene(layout, p.x, p.y)
        return (
          <group key={p.id} position={[s.x, 0, s.z]}>
            <mesh position={[0, 0.35, 0]} castShadow>
              <boxGeometry args={[0.7, 0.7, 0.7]} />
              <meshStandardMaterial color="#15803d" />
            </mesh>
            <mesh position={[0, 0.78, 0]}>
              <boxGeometry args={[0.55, 0.08, 0.55]} />
              <meshStandardMaterial color="#4ade80" emissive="#166534" emissiveIntensity={0.35} />
            </mesh>
            <Text position={[0, 1.05, 0]} fontSize={0.22} color="#14532d" anchorX="center">
              ЗС
            </Text>
          </group>
        )
      })}
    </group>
  )
}

function Routes({
  layout,
  robots,
  selectedRobotId,
  visible,
}: {
  layout: VisualizationLayout
  robots: SimRobot[]
  selectedRobotId: string | null
  visible: boolean
}) {
  if (!visible) return null
  return (
    <group>
      {(layout.routes || []).map((route) => {
        const selected = robots.find((r) => r.id === selectedRobotId)?.routeId === route.id
        const dim = selectedRobotId && !selected
        const pts = (route.points || []).map((p) => {
          const s = toScene(layout, p.x, p.y)
          return new THREE.Vector3(s.x, 0.06, s.z)
        })
        if (pts.length < 2) return null
        const curve = new THREE.CatmullRomCurve3(pts)
        const geo = new THREE.TubeGeometry(curve, 48, selected ? 0.07 : 0.045, 8, false)
        return (
          <mesh key={route.id} geometry={geo}>
            <meshStandardMaterial
              color="#f07316"
              transparent
              opacity={dim ? 0.18 : selected ? 0.95 : 0.7}
              roughness={0.45}
            />
          </mesh>
        )
      })}
    </group>
  )
}

function AmrRobot({
  robot,
  layout,
  selected,
  onSelect,
}: {
  robot: SimRobot
  layout: VisualizationLayout
  selected: boolean
  onSelect: () => void
}) {
  const s = toScene(layout, robot.x, robot.y)
  const color = STATUS_COLOR[robot.status]
  return (
    <group
      position={[s.x, 0.28, s.z]}
      rotation={[0, -robot.heading + Math.PI / 2, 0]}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      {/* chassis */}
      <mesh castShadow>
        <boxGeometry args={[0.95, 0.32, 0.72]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.15} />
      </mesh>
      {/* deck */}
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.78, 0.08, 0.58]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {/* status LED strip */}
      <mesh position={[0, 0.12, 0.37]}>
        <boxGeometry args={[0.5, 0.04, 0.04]} />
        <meshStandardMaterial
          color="#f07316"
          emissive="#f07316"
          emissiveIntensity={selected ? 0.8 : 0.35}
        />
      </mesh>
      {robot.cargoKg > 0 && (
        <mesh position={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[0.48, 0.28, 0.38]} />
          <meshStandardMaterial color="#eab308" />
        </mesh>
      )}
      {([-0.28, 0.28] as const).map((z) =>
        ([-0.32, 0.32] as const).map((x) => (
          <mesh key={`${x}-${z}`} position={[x, -0.1, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.09, 0.09, 0.07, 12]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
        )),
      )}
      {selected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.65, 0.78, 32]} />
          <meshBasicMaterial color="#f07316" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      )}
      <Text position={[0, 0.78, 0]} fontSize={0.26} color="#1c1f26" anchorX="center" outlineWidth={0.02} outlineColor="#ffffff">
        {robot.label}
      </Text>
    </group>
  )
}

function CollisionMarkers({
  layout,
  collisions,
  visible,
}: {
  layout: VisualizationLayout
  collisions: SimCollision[]
  visible: boolean
}) {
  if (!visible) return null
  return (
    <group>
      {collisions.map((c, i) => {
        const s = toScene(layout, c.x, c.y)
        return (
          <mesh key={i} position={[s.x, 0.04, s.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.45, 0.65, 28]} />
            <meshBasicMaterial color="#b91c1c" transparent opacity={0.75} />
          </mesh>
        )
      })}
    </group>
  )
}

function CameraRig({
  preset,
  onApplied,
  followRobot,
  selected,
  layout,
}: {
  preset: Props['cameraPreset']
  onApplied: () => void
  followRobot: boolean
  selected: SimRobot | null
  layout: VisualizationLayout
}) {
  const { camera } = useThree()
  const controls = useThree((s) => s.controls) as unknown as {
    target: THREE.Vector3
    update: () => void
  } | null
  const applied = useRef<string | null>(null)

  useFrame(() => {
    if (preset !== 'reset' && applied.current !== preset) {
      if (preset === 'top') {
        camera.position.set(0, 32, 0.01)
        camera.lookAt(0, 0, 0)
      } else if (preset === 'side') {
        camera.position.set(28, 8, 0)
        camera.lookAt(0, 0, 0)
      } else if (preset === 'iso') {
        camera.position.set(18, 16, 18)
        camera.lookAt(0, 0, 0)
      }
      applied.current = preset
      onApplied()
    }
    if (followRobot && selected) {
      const s = toScene(layout, selected.x, selected.y)
      camera.position.lerp(new THREE.Vector3(s.x + 6, 8, s.z + 6), 0.08)
      if (controls?.target) {
        controls.target.lerp(new THREE.Vector3(s.x, 0.3, s.z), 0.08)
        controls.update()
      }
    }
  })
  return null
}

function SceneContent(props: Props) {
  const selected = props.robots.find((r) => r.id === props.selectedRobotId) || null
  return (
    <>
      <color attach="background" args={['#e8ebf0']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[14, 22, 10]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]} />
      <hemisphereLight args={['#f8fafc', '#94a3b8', 0.35]} />
      <Floor />
      <Shelves layout={props.layout} visible={props.layers.shelves} />
      <Zones layout={props.layout} visible={props.layers.zones} />
      <Routes
        layout={props.layout}
        robots={props.robots}
        selectedRobotId={props.selectedRobotId}
        visible={props.layers.routes}
      />
      {props.layers.robots &&
        props.robots.map((r) => (
          <AmrRobot
            key={r.id}
            robot={r}
            layout={props.layout}
            selected={r.id === props.selectedRobotId}
            onSelect={() => props.onSelectRobot(r.id)}
          />
        ))}
      <CollisionMarkers
        layout={props.layout}
        collisions={props.collisions}
        visible={props.layers.collisions}
      />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2.05} />
      <CameraRig
        preset={props.cameraPreset}
        onApplied={props.onCameraApplied}
        followRobot={props.followRobot}
        selected={selected}
        layout={props.layout}
      />
    </>
  )
}

export function Warehouse3D(props: Props) {
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
      <div className="flex h-[420px] flex-col items-center justify-center gap-2 rounded border border-dashed border-steel-300 bg-steel-50 p-6 text-center">
        <p className="text-sm font-medium text-steel-800">WebGL недоступен</p>
        <p className="max-w-sm text-sm text-steel-500">
          Используйте режимы 2D или изометрия. Обновите браузер или включите аппаратное ускорение.
        </p>
      </div>
    )
  }

  return (
    <div className="h-[min(58vh,500px)] min-h-[340px] w-full overflow-hidden rounded-sm bg-[#e8ebf0] ring-1 ring-steel-200/80">
      <Canvas shadows camera={{ position: [18, 16, 18], fov: 42 }} dpr={[1, 1.75]}>
        <Suspense fallback={null}>
          <SceneContent {...props} />
        </Suspense>
      </Canvas>
    </div>
  )
}
