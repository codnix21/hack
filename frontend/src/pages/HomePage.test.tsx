import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HomePage } from '../pages/HomePage'

describe('HomePage', () => {
  it('renders brand and Russian title', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    expect(screen.getByText('РобоПодбор')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: /Подбор роботизированных решений/i,
      }),
    ).toBeInTheDocument()
  })
})
