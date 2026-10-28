import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Layout3DPreview } from './Layout3DPreview'
import type { WarehouseLayout } from '../../types'

const sampleLayout: WarehouseLayout = {
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
      <Layout3DPreview
        layout={{ width_m: 20, length_m: 15, objects: [], routes: [] }}
      />,
    )
    expect(screen.getByTestId('layout-3d-empty')).toBeInTheDocument()
  })

  it('shows WebGL fallback when renderer context is unavailable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    render(<Layout3DPreview layout={sampleLayout} />)
    expect(screen.getByTestId('layout-3d-webgl-fallback')).toBeInTheDocument()
    expect(screen.getByText(/WebGL недоступен/i)).toBeInTheDocument()
  })
})
