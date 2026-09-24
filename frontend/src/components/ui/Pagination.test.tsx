import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Pagination } from './Pagination'

describe('Pagination', () => {
  it('shows Russian navigation labels', () => {
    render(
      <Pagination page={2} pageSize={10} total={50} onPageChange={vi.fn()} />,
    )
    expect(screen.getByLabelText('Первая страница')).toBeInTheDocument()
    expect(screen.getByLabelText('Предыдущая страница')).toBeInTheDocument()
    expect(screen.getByLabelText('Следующая страница')).toBeInTheDocument()
    expect(screen.getByLabelText('Последняя страница')).toBeInTheDocument()
  })
})
