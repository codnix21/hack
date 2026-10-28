import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { WarehouseLayoutEditor } from './WarehouseLayoutEditor'
import { projectsApi } from '../../api/projects'

vi.mock('../../api/projects', () => ({
  projectsApi: {
    getLayout: vi.fn(),
    saveLayout: vi.fn(),
  },
}))

describe('WarehouseLayoutEditor narrow viewport', () => {
  let matchMediaImpl: (query: string) => MediaQueryList

  beforeEach(() => {
    vi.mocked(projectsApi.getLayout).mockResolvedValue({
      width_m: 40,
      length_m: 30,
      objects: [{ id: 'wall_contour', kind: 'wall', name: 'Контур', x: 0, y: 0, width: 40, height: 30 }],
      routes: [],
    } as never)

    matchMediaImpl = (query: string) =>
      ({
        matches: query.includes('max-width: 1023px'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList
    vi.stubGlobal('matchMedia', matchMediaImpl)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows read-only hint and hides route tool on narrow screens', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <MemoryRouter>
        <QueryClientProvider client={qc}>
          <WarehouseLayoutEditor projectId="1" />
        </QueryClientProvider>
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('layout-mobile-hint')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('layout-tool-route')).not.toBeInTheDocument()
  })
})
