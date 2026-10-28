import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Layout3DPreview } from './Layout3DPreview'
import type { WarehouseLayout } from '../../types'

const sampleLayout: WarehouseLayout = {
  unit: 'm',
  width_m: 40,
  length_m: 30,
  objects: [
    { id: 'rack_1', kind: 'rack', name: 'Стеллаж', x: 5, y: 5, width: 2, height: 4 },
  ],
  routes: [],
}

describe('Layout3DPreview', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows empty state when layout has no objects or routes', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext)
    render(
      <Layout3DPreview layout={{ unit: 'm', width_m: 20, length_m: 15, objects: [], routes: [] }} />,
    )
    expect(screen.getByTestId('layout-3d-empty')).toBeInTheDocument()
  })

  it('shows WebGL fallback when renderer context is unavailable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    render(<Layout3DPreview layout={sampleLayout} />)
    expect(screen.getByTestId('layout-3d-webgl-fallback')).toBeInTheDocument()
    expect(screen.getByText(/WebGL недоступен/i)).toBeInTheDocument()
  })

  it('exposes layer toggles and fit control when WebGL works', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext)
    class RO {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', RO)
    // Canvas lazy-load may fail in jsdom — layers UI still mounts before Suspense content
    render(<Layout3DPreview layout={sampleLayout} />)
    expect(screen.getByTestId('layout-3d-preview')).toBeInTheDocument()
    expect(screen.getByTestId('layout-3d-layers')).toBeInTheDocument()
    expect(screen.getByTestId('layout-3d-fit')).toBeInTheDocument()
    expect(screen.getByTestId('layout-3d-layer-grid')).toBeChecked()
    await userEvent.click(screen.getByTestId('layout-3d-layer-grid'))
    expect(screen.getByTestId('layout-3d-layer-grid')).not.toBeChecked()
  })
})
