import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WarehouseLayoutEditor, clientToLayoutMeters } from './WarehouseLayoutEditor'

const layoutA = {
  width_m: 40,
  length_m: 30,
  objects: [{ id: 'rack_1', kind: 'rack', name: 'Стеллаж 1', x: 1, y: 1, width: 2, height: 4 }],
  source: 'manual',
}

const getLayout = vi.fn()
const saveLayout = vi.fn()

vi.mock('../../api/projects', () => ({
  projectsApi: {
    getLayout: (...args: unknown[]) => getLayout(...args),
    saveLayout: (...args: unknown[]) => saveLayout(...args),
    previewDxf: vi.fn(),
    applyDxf: vi.fn(),
  },
}))

vi.mock('../../store/toastStore', () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

function renderEditor(projectId: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <WarehouseLayoutEditor projectId={projectId} />
    </QueryClientProvider>,
  )
}

describe('clientToLayoutMeters', () => {
  it('maps click through CSS-shrunk canvas to object meters', () => {
    // bitmap 1100×680 CSS-сжат до 550×340 (как max-w-full)
    const rect = { left: 100, top: 50, width: 550, height: 340 }
    const mid = clientToLayoutMeters(100 + 275, 50 + 170, rect, 110, 68)
    expect(mid.x).toBeCloseTo(55, 5)
    expect(mid.y).toBeCloseTo(34, 5)
    // клик в центре объекта (x=10..18 → центр 14 м)
    const atRack = clientToLayoutMeters(100 + (14 / 110) * 550, 50 + (12 / 68) * 340, rect, 110, 68)
    expect(atRack.x).toBeCloseTo(14, 5)
    expect(atRack.y).toBeCloseTo(12, 5)
  })
})

describe('WarehouseLayoutEditor undo scope', () => {
  beforeEach(() => {
    getLayout.mockReset()
    saveLayout.mockReset()
    getLayout.mockResolvedValue({ ...layoutA, objects: [...layoutA.objects] })
    saveLayout.mockImplementation(async (_id: string, layout: unknown) => layout)
    // jsdom: ResizeObserver for fit viewport
    class RO {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', RO)
    // canvas stub
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      setLineDash: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext
  })

  it('shows local undo scope label and disables undo until edit', async () => {
    renderEditor('11')
    expect(await screen.findByTestId('layout-undo-scope')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('layout-undo')).toBeDisabled())
  })

  it('undo restores previous local state; save persists current', async () => {
    const user = userEvent.setup()
    renderEditor('11')
    await screen.findByTestId('layout-add-rack')
    await user.click(screen.getByTestId('layout-add-rack'))
    await waitFor(() => expect(screen.getByTestId('layout-undo')).not.toBeDisabled())
    await user.click(screen.getByTestId('layout-undo'))
    await waitFor(() => expect(screen.getByTestId('layout-undo')).toBeDisabled())
    await user.click(screen.getByTestId('layout-save'))
    await waitFor(() => expect(saveLayout).toHaveBeenCalled())
    const saved = saveLayout.mock.calls.at(-1)?.[1] as { objects: unknown[] }
    expect(saved.objects).toHaveLength(1)
  })

  it('resets undo history when projectId changes', async () => {
    const user = userEvent.setup()
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { rerender } = render(
      <QueryClientProvider client={qc}>
        <WarehouseLayoutEditor projectId="11" />
      </QueryClientProvider>,
    )
    await screen.findByTestId('layout-add-rack')
    await user.click(screen.getByTestId('layout-add-rack'))
    await waitFor(() => expect(screen.getByTestId('layout-undo')).not.toBeDisabled())

    getLayout.mockResolvedValue({
      width_m: 20,
      length_m: 20,
      objects: [],
      source: 'manual',
    })
    rerender(
      <QueryClientProvider client={qc}>
        <WarehouseLayoutEditor projectId="22" />
      </QueryClientProvider>,
    )
    await waitFor(() => expect(getLayout).toHaveBeenCalledWith('22'))
    await waitFor(() => expect(screen.getByTestId('layout-undo')).toBeDisabled())
  })
})
