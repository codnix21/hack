import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CatalogPage } from './CatalogPage'
import { catalogApi } from '../api/catalog'

vi.mock('../api/catalog', () => ({
  catalogApi: {
    filters: vi.fn(),
    stats: vi.fn(),
    list: vi.fn(),
  },
}))

function renderCatalog(initial = '/app/catalog?search=none-such') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/app/catalog" element={<CatalogPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CatalogPage', () => {
  beforeEach(() => {
    vi.mocked(catalogApi.filters).mockResolvedValue({
      manufacturers: [],
      solution_types: [],
      catalog_type_raw: [],
      subtype_raw: [],
      industry_raw: [],
      region_raw: [],
      scenario_raw: [],
    } as never)
    vi.mocked(catalogApi.stats).mockResolvedValue({ source_count: 10, demo_count: 2 } as never)
    vi.mocked(catalogApi.list).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 } as never)
  })

  it('shows empty state and reset when filters yield no rows', async () => {
    renderCatalog('/app/catalog?search=zzz-empty')
    await waitFor(() => {
      expect(screen.getByTestId('catalog-empty')).toBeInTheDocument()
    })
    expect(screen.getByText(/Решения не найдены/i)).toBeInTheDocument()
    expect(screen.getByTestId('catalog-reset-filters')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('catalog-reset-filters'))
    await waitFor(() => {
      expect(vi.mocked(catalogApi.list).mock.calls.length).toBeGreaterThan(1)
    })
  })

  it('shows error state with retry on list failure', async () => {
    // retry:1 на listQuery — устойчивый отказ; ждём дольше из‑за delay RQ
    vi.mocked(catalogApi.list).mockRejectedValue(new Error('network'))
    renderCatalog('/app/catalog')
    await waitFor(
      () => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument()
      },
      { timeout: 8_000 },
    )
    expect(screen.getByRole('button', { name: /Повторить/i })).toBeInTheDocument()
  })
})
