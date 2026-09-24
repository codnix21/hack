import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: string
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
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-steel-200 bg-steel-50 text-steel-600">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-4 py-3 font-medium ${c.className ?? ''}`}>
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
              className={`border-b border-steel-100 ${onRowClick ? 'cursor-pointer hover:bg-brand-50/40' : ''}`}
            >
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-3 text-steel-800 ${c.className ?? ''}`}>
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
