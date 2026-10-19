import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WarehouseStats } from './WarehouseStats'
import type { SimulationSnapshot } from '../../simulation/types'
import { computeSimMetrics } from '../../simulation/simMetrics'

function snap(partial: Partial<SimulationSnapshot> = {}): SimulationSnapshot {
  const robots = [
    {
      id: 'r1',
      label: 'R1',
      type: 'AMR' as const,
      x: 10,
      y: 10,
      heading: 0,
      speedFactor: 1,
      speedMps: 1.2,
      status: 'MOVING' as const,
      battery: 90,
      cargoKg: 0,
      routeId: 'route_1',
      taskId: 't1',
      routeDistPx: 10,
      completedDistance: 5,
      cycles: 1,
      phase: 0.3,
      waitSec: 0,
    },
    {
      id: 'r2',
      label: 'R2',
      type: 'AMR' as const,
      x: 20,
      y: 10,
      heading: 0,
      speedFactor: 1,
      speedMps: 1.2,
      status: 'IDLE' as const,
      battery: 80,
      cargoKg: 0,
      routeId: '',
      taskId: null,
      routeDistPx: 0,
      completedDistance: 0,
      cycles: 0,
      phase: 0,
      waitSec: 0,
    },
  ]
  const tasks = [
    {
      id: 't1',
      status: 'NAVIGATING' as const,
      robotId: 'r1',
      source: 'load1',
      destination: 'unload1',
      cargoWeight: 10,
      createdAt: 0,
      startedAt: 1,
      completedAt: null,
      routePoints: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      lengthM: 10,
      executableLengthM: 10,
    },
    {
      id: 't2',
      status: 'BLOCKED' as const,
      robotId: null,
      source: 'A',
      destination: 'B',
      cargoWeight: 0,
      createdAt: 0,
      startedAt: null,
      completedAt: null,
      routePoints: [],
      lengthM: 0,
      executableLengthM: 0,
      plannedLengthM: 40,
      blocked: true,
    },
  ]
  const base = {
    play: 'running' as const,
    speed: 1,
    progress: 0.2,
    robots,
    tasks,
    events: [],
    collisions: [],
    visibleRobots: 6,
    totalRobots: 20,
    robotsCapped: true,
  }
  const metrics = computeSimMetrics({
    play: base.play,
    robots,
    tasks,
    configuredRobots: 20,
    visibleRobots: 6,
    robotsCapped: true,
  })
  return {
    ...base,
    phase: metrics.phase,
    kpi: {
      activeRobots: metrics.movingRobots + metrics.waitingRobots,
      distance: metrics.acceptedDistanceMeters,
      cycles: 3,
      completedTasks: metrics.completedTasks,
      activityPct: 40,
      avgSpeed: 1,
    },
    metrics,
    ...partial,
  }
}

describe('WarehouseStats robot honesty', () => {
  it('shows config count and animated N of M for capped fleets', () => {
    render(<WarehouseStats snapshot={snap()} />)
    expect(screen.getByText('В конфигурации')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText(/на схеме анимируется 6 из 20/i)).toBeInTheDocument()
  })

  it('uses shared metrics: active vs blocked not conflated', () => {
    render(<WarehouseStats snapshot={snap()} />)
    expect(screen.getByText(/активны 1/i)).toBeInTheDocument()
    expect(screen.getByText(/блок\. 1/i)).toBeInTheDocument()
  })

  it('does not claim demo subset when fleet fits on scene', () => {
    const s = snap()
    const metrics = { ...s.metrics, configuredRobots: 6, visibleRobots: 6, robotsCapped: false }
    render(
      <WarehouseStats
        snapshot={{ ...s, totalRobots: 6, visibleRobots: 6, robotsCapped: false, metrics }}
      />,
    )
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.queryByText(/демо-подмножество/i)).not.toBeInTheDocument()
  })
})
