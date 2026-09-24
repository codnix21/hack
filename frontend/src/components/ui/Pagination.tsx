import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from './Button'
import { Select } from './Select'
import { paginationLabel } from '../../utils/format'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
}: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-steel-200 bg-steel-50/50 px-4 py-3">
      <p className="font-mono text-xs text-steel-600">{paginationLabel(page, pageSize, total)}</p>
      <div className="flex flex-wrap items-center gap-3">
        {onPageSizeChange && (
          <Select
            className="w-28"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            options={pageSizeOptions.map((n) => ({ value: n, label: String(n) }))}
            aria-label="Размер страницы"
          />
        )}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(1)}
            aria-label="Первая страница"
          >
            <ChevronsLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Первая</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Предыдущая страница"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Предыдущая</span>
          </Button>
          <span className="min-w-[5rem] text-center text-sm text-steel-700">
            {page} / {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Следующая страница"
          >
            <span className="hidden sm:inline">Следующая</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => onPageChange(pages)}
            aria-label="Последняя страница"
          >
            <span className="hidden sm:inline">Последняя</span>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
