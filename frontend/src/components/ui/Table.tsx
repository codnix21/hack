import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: ReactNode
  className?: string
  render?: (row: T) => ReactNode
}

interface TableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  empty?: ReactNode
  onRowClick?: (row: T) => void
}

export function Table<T>({ columns, rows, rowKey, empty, onRowClick }: TableProps<T>) {
  if (!rows.length && empty) return <>{empty}</>

  return (
    <div className="overflow-x-auto rounded border border-[var(--nc-border-subtle)]">
      <table className="nc-table min-w-full text-left">
        <thead className="border-b border-[var(--nc-border)] bg-[var(--nc-surface-muted)]">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.className ?? ''}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={String(rowKey(row))}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-[var(--nc-border-subtle)] last:border-0 ${
                onRowClick ? 'cursor-pointer hover:bg-[var(--nc-surface-hover)]' : ''
              }`}
            >
              {columns.map((c) => (
                <td key={c.key} className={`max-w-[16rem] truncate ${c.className ?? ''}`} title={
                  typeof (row as Record<string, unknown>)[c.key] === 'string'
                    ? String((row as Record<string, unknown>)[c.key])
                    : undefined
                }>
                  {c.render
                    ? c.render(row)
                    : String((row as Record<string, unknown>)[c.key] ?? 'Нет данных')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
