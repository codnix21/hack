import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { VisualizationLayout } from '../../types'
import type { LayerFlags, SimRobot, SimCollision } from '../../simulation/types'
import { STATUS_COLOR } from '../../simulation/types'
import {
  fitCameraPosition,
  topCameraPosition,
  vizExtentsM,
  vizPxToScene,
  vizRectToSceneBox,
} from '../../utils/sceneCoords'
import { useThemeStore } from '../../store/themeStore'

/** Опциональная модель AMR из Blender (public/models/amr.glb). */
const AMR_GLB = '/models/amr.glb'

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

function Floor({
  widthM,
  lengthM,
  floor,
  grid,
}: {
  widthM: number
  lengthM: number
  floor: string
  grid: string
}) {
  const span = Math.max(widthM, lengthM)
  const divisions = Math.max(8, Math.round(span))
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[widthM, lengthM]} />
        <meshStandardMaterial color={floor} roughness={0.92} metalness={0.05} />
      </mesh>
      <gridHelper args={[span, divisions, grid, grid]} position={[0, 0.02, 0]} />
      {(
        [
          [0, 0.1, -lengthM / 2, widthM + 0.2, 0.2, 0.2],
          [0, 0.1, lengthM / 2, widthM + 0.2, 0.2, 0.2],
          [-widthM / 2, 0.1, 0, 0.2, 0.2, lengthM],
          [widthM / 2, 0.1, 0, 0.2, 0.2, lengthM],
        ] as const
      ).map(([x, y, z, sx, sy, sz], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[sx, sy, sz]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
      ))}
    </group>
  )
}

function Shelves({ layout, visible }: { layout: VisualizationLayout; visible: boolean }) {
  if (!visible) return null
  return (
    <group>
      {(layout.zones || [])
        .filter((z) => (z.type || '') === 'storage' || (z.type || '') === 'rack')
        .map((z) => {
          const box = vizRectToSceneBox(layout, z.x, z.y, z.w, z.h)
          const rot = ((z.rotation || 0) * Math.PI) / 180
          return (
            <group key={z.id} position={[box.cx, 0, box.cz]} rotation={[0, -rot, 0]}>
              {(
                [
                  [-box.sx / 2 + 0.06, -box.sz / 2 + 0.06],
                  [box.sx / 2 - 0.06, -box.sz / 2 + 0.06],
                  [-box.sx / 2 + 0.06, box.sz / 2 - 0.06],
                  [box.sx / 2 - 0.06, box.sz / 2 - 0.06],
                ] as const
              ).map(([px, pz], i) => (
                <mesh key={i} position={[px, 1.1, pz]} castShadow>
                  <boxGeometry args={[0.08, 2.2, 0.08]} />
                  <meshStandardMaterial color="#64748b" />
                </mesh>
              ))}
              {[0.35, 1.05, 1.75].map((y) => (
                <mesh key={y} position={[0, y, 0]} castShadow receiveShadow>
                  <boxGeometry args={[box.sx, 0.08, box.sz]} />
                  <meshStandardMaterial color="#8fa3b8" roughness={0.7} />
                </mesh>
              ))}
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
        .filter((z) => {
          const t = (z.type || '').toLowerCase()
          return t !== 'storage' && t !== 'rack'
        })
        .map((z) => {
          const box = vizRectToSceneBox(layout, z.x, z.y, z.w, z.h)
          const t = (z.type || '').toLowerCase()
          const color =
            t === 'load'
              ? '#fdba74'
              : t === 'unload'
                ? '#93c5fd'
                : t === 'obstacle' || t === 'wall'
                  ? '#fecaca'
                  : t === 'charge' || t === 'charging'
                    ? '#bbf7d0'
                    : '#e8ecf1'
          const h = t === 'obstacle' || t === 'wall' ? 2.4 : 0.04
          return (
            <mesh
              key={z.id}
              position={[box.cx, h / 2, box.cz]}
              rotation={t === 'obstacle' || t === 'wall' ? [0, 0, 0] : [-Math.PI / 2, 0, 0]}
            >
              {t === 'obstacle' || t === 'wall' ? (
                <boxGeometry args={[box.sx, h, box.sz]} />
              ) : (
                <planeGeometry args={[box.sx, box.sz]} />
              )}
              <meshStandardMaterial
                color={color}
                transparent
                opacity={t === 'obstacle' || t === 'wall' ? 0.85 : 0.9}
              />
            </mesh>
          )
        })}
      {(layout.charging_stations || []).map((p) => {
        const s = vizPxToScene(layout, p.x, p.y)
        return (
          <group key={p.id} position={[s.x, 0, s.z]}>
            <mesh position={[0, 0.35, 0]} castShadow>
              <boxGeometry args={[0.7, 0.7, 0.7]} />
              <meshStandardMaterial color="#15803d" />
            </mesh>
            <Text position={[0, 1.05, 0]} fontSize={0.28} color="#14532d" anchorX="center">
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
        if (route.blocked) return null
        const pts = (route.points || []).map((p) => {
          const s = vizPxToScene(layout, p.x, p.y)
          return new THREE.Vector3(s.x, 0.08, s.z)
        })
        if (pts.length < 2) return null
        const selected = robots.find((r) => r.id === selectedRobotId)?.routeId === route.id
        const dim = Boolean(selectedRobotId && !selected)
        const curve = new THREE.CatmullRomCurve3(pts)
        const geo = new THREE.TubeGeometry(curve, Math.min(64, pts.length * 8), selected ? 0.08 : 0.05, 6, false)
        return (
          <mesh key={route.id} geometry={geo}>
            <meshStandardMaterial
              color="#f07316"
              transparent
              opacity={dim ? 0.2 : selected ? 0.95 : 0.7}
              roughness={0.45}
            />
          </mesh>
        )
      })}
    </group>
  )
}

function AmrGlbBody({ color }: { color: string }) {
  const gltf = useGLTF(AMR_GLB)
  const cloned = useMemo(() => {
    const root = gltf.scene.clone(true)
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh
        mesh.castShadow = true
        if (mesh.material && 'color' in mesh.material) {
          const mat = (mesh.material as THREE.MeshStandardMaterial).clone()
          mat.color = new THREE.Color(color)
          mesh.material = mat
        }
      }
    })
    return root
  }, [gltf.scene, color])
  return <primitive object={cloned} scale={1} />
}

function AmrProcedural({ color, selected, cargoKg }: { color: string; selected: boolean; cargoKg: number }) {
  return (
    <>
      <mesh castShadow>
        <boxGeometry args={[0.95, 0.32, 0.72]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.78, 0.08, 0.58]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0, 0.12, 0.37]}>
        <boxGeometry args={[0.5, 0.04, 0.04]} />
        <meshStandardMaterial
          color="#f07316"
          emissive="#f07316"
          emissiveIntensity={selected ? 0.8 : 0.35}
        />
      </mesh>
      {cargoKg > 0 && (
        <mesh position={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[0.48, 0.28, 0.38]} />
          <meshStandardMaterial color="#eab308" />
        </mesh>
      )}
    </>
  )
}

function AmrRobot({
  robot,
  layout,
  selected,
  onSelect,
  useGlb,
}: {
  robot: SimRobot
  layout: VisualizationLayout
  selected: boolean
  onSelect: () => void
  useGlb: boolean
}) {
  const s = vizPxToScene(layout, robot.x, robot.y)
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
      {useGlb ? (
        <Suspense fallback={<AmrProcedural color={color} selected={selected} cargoKg={robot.cargoKg} />}>
          <AmrGlbBody color={color} />
        </Suspense>
      ) : (
        <AmrProcedural color={color} selected={selected} cargoKg={robot.cargoKg} />
      )}
      {selected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.65, 0.78, 32]} />
          <meshBasicMaterial color="#f07316" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      )}
      <Text
        position={[0, 0.85, 0]}
        fontSize={0.28}
        color="#1c1f26"
        anchorX="center"
        outlineWidth={0.02}
        outlineColor="#ffffff"
      >
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
        const s = vizPxToScene(layout, c.x, c.y)
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
  const extents = vizExtentsM(layout)

  useFrame(() => {
    if (preset !== 'reset' && applied.current !== preset) {
      if (preset === 'top') {
        const c = topCameraPosition(extents)
        camera.position.set(...c.position)
        camera.lookAt(...c.target)
      } else if (preset === 'side') {
        const span = Math.max(extents.widthM, extents.lengthM, 8)
        camera.position.set(span * 1.1, span * 0.35, 0)
        camera.lookAt(0, 0, 0)
      } else if (preset === 'iso') {
        const c = fitCameraPosition(extents)
        camera.position.set(...c.position)
        camera.lookAt(...c.target)
      }
      if (controls?.target) {
        controls.target.set(0, 0, 0)
        controls.update()
      }
      applied.current = preset
      onApplied()
    }
    if (followRobot && selected) {
      const s = vizPxToScene(layout, selected.x, selected.y)
      camera.position.lerp(new THREE.Vector3(s.x + 6, 8, s.z + 6), 0.08)
      if (controls?.target) {
        controls.target.lerp(new THREE.Vector3(s.x, 0.3, s.z), 0.08)
        controls.update()
      }
    }
  })
  return null
}

function SceneContent(props: Props & { bg: string; floor: string; grid: string; useGlb: boolean }) {
  const selected = props.robots.find((r) => r.id === props.selectedRobotId) || null
  const extents = vizExtentsM(props.layout)
  return (
    <>
      <color attach="background" args={[props.bg]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[14, 22, 10]} intensity={1.05} castShadow={false} />
      <hemisphereLight args={['#f8fafc', '#94a3b8', 0.35]} />
      <Floor widthM={extents.widthM} lengthM={extents.lengthM} floor={props.floor} grid={props.grid} />
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
            useGlb={props.useGlb}
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
  const theme = useThemeStore((s) => s.theme)
  const [useGlb, setUseGlb] = useState(false)
  const webglOk = useMemo(() => {
    try {
      const c = document.createElement('canvas')
      return !!(c.getContext('webgl') || c.getContext('experimental-webgl'))
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(AMR_GLB, { method: 'HEAD' })
      .then((r) => {
        if (!cancelled) setUseGlb(r.ok)
      })
      .catch(() => {
        if (!cancelled) setUseGlb(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const colors = useMemo(
    () =>
      theme === 'light'
        ? { bg: '#e8ebf0', floor: '#d9dde3', grid: '#a8b2c1' }
        : { bg: '#121826', floor: '#1c2433', grid: '#3d4a60' },
    [theme],
  )

  const extents = vizExtentsM(props.layout)
  const cam = fitCameraPosition(extents)

  if (!webglOk) {
    return (
      <div
        className="flex h-[420px] flex-col items-center justify-center gap-2 rounded border border-dashed border-[var(--nc-border)] bg-[var(--nc-surface-muted)] p-6 text-center"
        data-testid="warehouse-3d-webgl-fallback"
      >
        <p className="text-sm font-medium text-[var(--nc-ink)]">WebGL недоступен</p>
        <p className="max-w-sm text-sm text-[var(--nc-text)]">
          Используйте режимы 2D или изометрия. Обновите браузер или включите аппаратное ускорение.
        </p>
      </div>
    )
  }

  return (
    <div
      className="h-[min(62vh,560px)] min-h-[360px] w-full overflow-hidden rounded-sm ring-1 ring-[var(--nc-border)]"
      style={{ background: colors.bg }}
      data-testid="warehouse-3d-canvas"
    >
      <Canvas
        key={`${extents.widthM}x${extents.lengthM}-${theme}`}
        shadows={false}
        camera={{ position: cam.position, fov: 42 }}
        dpr={[1, 1.5]}
        onCreated={({ gl }) => {
          gl.setClearColor(colors.bg)
        }}
      >
        <Suspense fallback={null}>
          <SceneContent {...props} bg={colors.bg} floor={colors.floor} grid={colors.grid} useGlb={useGlb} />
        </Suspense>
      </Canvas>
    </div>
  )
}
