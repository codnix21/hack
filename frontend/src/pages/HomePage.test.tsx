import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HomePage } from '../pages/HomePage'
import { useAuthStore } from '../store/authStore'

vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn(),
}))

vi.mock('../api/projects', () => ({
  projectsApi: {
    list: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('../api/catalog', () => ({
  catalogApi: {
    objectTypes: vi.fn().mockResolvedValue([]),
  },
}))

function renderHome() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.mocked(useAuthStore).mockImplementation((sel: (s: { token: string }) => unknown) =>
      sel({ token: 'test-token' }),
    )
  })

  it('renders value proposition in Russian', () => {
    renderHome()
    expect(screen.getByText('NETCORE')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: /Предынвестиционная оценка роботизации склада/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Создать проект/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Открыть пример/i })).toBeInTheDocument()
  })
})
