import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorState } from './ErrorState'

describe('ErrorState', () => {
  it('calls onRetry when safe refetch is provided', async () => {
    const onRetry = vi.fn()
    render(<ErrorState description="Сбой сети" onRetry={onRetry} />)
    await userEvent.click(screen.getByRole('button', { name: /Повторить/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('omits retry button when onRetry is not set', () => {
    render(<ErrorState title="Ошибка" />)
    expect(screen.queryByRole('button', { name: /Повторить/i })).not.toBeInTheDocument()
  })
})
