import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ObjectParamsForm } from './ObjectParamsForm'

describe('ObjectParamsForm', () => {
  it('renders fields from schema', () => {
    render(
      <ObjectParamsForm
        objectType="warehouse"
        values={{}}
        onChange={vi.fn()}
        schema={{
          properties: {
            peak_demand: { type: 'number', title: 'Пиковый спрос, оп/ч' },
            indoor: { type: 'boolean', title: 'В помещении' },
            zone_type: { type: 'string', title: 'Тип зоны', enum: ['a', 'b'] },
          },
        }}
      />,
    )
    expect(screen.getByText(/Пиковая нагрузка/)).toBeInTheDocument()
    expect(screen.getByText(/Работа в помещении/)).toBeInTheDocument()
    expect(screen.getByText(/Тип зоны/)).toBeInTheDocument()
  })

  it('falls back to hardcoded warehouse fields without schema', () => {
    render(
      <ObjectParamsForm objectType="warehouse" values={{}} onChange={vi.fn()} />,
    )
    expect(screen.getByText(/Ширина площадки/)).toBeInTheDocument()
  })

  it('compact mode keeps values and shows required peak', () => {
    const onChange = vi.fn()
    render(
      <ObjectParamsForm
        objectType="warehouse"
        values={{ peak_demand: 100, aisle_width_mm: 2800 }}
        onChange={onChange}
        compactMode
      />,
    )
    expect(screen.getByLabelText(/Пиковая нагрузка/i)).toHaveValue(100)
    expect(screen.queryByLabelText(/Ширина прохода/i)).not.toBeInTheDocument()
  })
})
