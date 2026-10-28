import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LandingPage } from './LandingPage'
import { useAuthStore } from '../store/authStore'

vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn(),
}))

describe('LandingPage', () => {
  beforeEach(() => {
    vi.mocked(useAuthStore).mockImplementation((sel: (s: { continueAsGuest: () => Promise<void> }) => unknown) =>
      sel({ continueAsGuest: vi.fn().mockResolvedValue(undefined) }),
    )
  })

  it('shows brand-led hero and primary CTAs', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )
    expect(screen.getAllByText('NETCORE').length).toBeGreaterThanOrEqual(1)
    expect(
      screen.getByRole('heading', {
        name: /Оценка роботизации склада до закупки оборудования/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Создать проект/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: /Смотреть примеры/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('link', { name: /^Войти$/i }).length).toBeGreaterThanOrEqual(1)
  })
})
