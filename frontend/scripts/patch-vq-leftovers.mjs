/** One-shot dark-token remaps for remaining light leftovers (VQ pass). */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('frontend/src')

const files = {
  'components/ui/Modal.tsx': [
    ['text-sm leading-relaxed text-steel-700', 'text-sm leading-relaxed text-[var(--nc-text)]'],
  ],
  'components/ui/Pagination.tsx': [
    ['text-sm text-steel-700', 'text-sm text-[var(--nc-text)]'],
  ],
  'components/project/UnsavedChangesGuard.tsx': [
    ['text-sm leading-relaxed text-steel-700', 'text-sm leading-relaxed text-[var(--nc-text)]'],
  ],
  'components/ProtectedRoute.tsx': [
    ['bg-steel-50', 'bg-[var(--nc-bg)]'],
  ],
  'pages/ComparePage.tsx': [
    ["differs ? 'bg-amber-50/40' : undefined", "differs ? 'bg-[var(--nc-warning-soft)]' : undefined"],
  ],
  'components/ui/Button.tsx': [
    [
      "ghost: 'bg-transparent text-steel-300 hover:bg-white/5 hover:text-[var(--nc-ink)]'",
      "ghost: 'bg-transparent text-[var(--nc-text)] hover:bg-[var(--nc-surface-hover)] hover:text-[var(--nc-ink)]'",
    ],
  ],
  'components/layout/Sidebar.tsx': [
    ['text-steel-500', 'text-[var(--nc-muted)]'],
    ['text-steel-600', 'text-[var(--nc-muted)]'],
    ['text-steel-200', 'text-[var(--nc-ink)]'],
  ],
  'components/warehouse/Warehouse3D.tsx': [
    [
      'border-dashed border-steel-300 bg-steel-50',
      'border-dashed border-[var(--nc-border)] bg-[var(--nc-surface-muted)]',
    ],
    ['text-sm font-medium text-steel-800', 'text-sm font-medium text-[var(--nc-ink)]'],
    ['text-sm text-steel-500', 'text-sm text-[var(--nc-text)]'],
  ],
}

function patchRobotDetails(s) {
  return s
    .replace(
      'overflow-hidden rounded border border-steel-200 bg-white shadow-panel',
      'overflow-hidden rounded border border-[var(--nc-border)] bg-[var(--nc-surface)] shadow-panel',
    )
    .replace(
      'border-b border-steel-100 bg-steel-50/70',
      'border-b border-[var(--nc-border-subtle)] bg-[var(--nc-surface-muted)]',
    )
    .replace(
      ": 'text-steel-700 hover:bg-white'",
      ": 'text-[var(--nc-text)] hover:bg-[var(--nc-surface-hover)]'",
    )
    .replace(/text-steel-800/g, 'text-[var(--nc-ink)]')
    .replace(/text-steel-500/g, 'text-[var(--nc-muted)]')
    .replace(/text-steel-400/g, 'text-[var(--nc-faint)]')
    .replace(/text-steel-900/g, 'text-[var(--nc-ink)]')
    .replace(/text-steel-700/g, 'text-[var(--nc-text)]')
    .replace(
      'border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900',
      'border border-[var(--nc-warning)]/40 bg-[var(--nc-warning-soft)] px-2 py-1 text-xs text-[var(--nc-warning)]',
    )
    .replace(
      'rounded border border-steel-100 bg-steel-50/60',
      'rounded border border-[var(--nc-border-subtle)] bg-[var(--nc-surface-muted)]',
    )
    .replace('border-steel-300', 'border-[var(--nc-border)]')
    .replace(
      'border border-steel-200 bg-white px-2 py-1 text-xs font-medium text-[var(--nc-ink)]',
      'border border-[var(--nc-border)] bg-[var(--nc-surface-raised)] px-2 py-1 text-xs font-medium text-[var(--nc-ink)]',
    )
    .replace('bg-steel-100', 'bg-[var(--nc-surface-hover)]')
    .replace(
      'rounded border border-steel-100 px-2.5 py-2',
      'rounded border border-[var(--nc-border-subtle)] bg-[var(--nc-surface-muted)] px-2.5 py-2',
    )
    .replace('text-red-700', 'text-[var(--nc-danger)]')
}

function patchWarehouseStats(s) {
  return s
    .replace(
      'rounded border border-steel-100 bg-steel-50/50',
      'rounded border border-[var(--nc-border-subtle)] bg-[var(--nc-surface-muted)]',
    )
    .replace(/text-steel-500/g, 'text-[var(--nc-muted)]')
    .replace(/text-steel-400/g, 'text-[var(--nc-faint)]')
    .replace(/text-steel-900/g, 'text-[var(--nc-ink)]')
    .replace(/text-steel-700/g, 'text-[var(--nc-text)]')
    .replace(
      "on ? 'bg-steel-50 text-steel-900' : 'text-steel-500 hover:bg-steel-50/80'",
      "on ? 'bg-[var(--nc-surface-hover)] text-[var(--nc-ink)]' : 'text-[var(--nc-muted)] hover:bg-[var(--nc-surface-hover)]/80'",
    )
    .replace(
      "on ? 'bg-[var(--nc-surface-hover)] text-[var(--nc-ink)]' : 'text-[var(--nc-muted)] hover:bg-[var(--nc-surface-hover)]/80'",
      "on ? 'bg-[var(--nc-surface-hover)] text-[var(--nc-ink)]' : 'text-[var(--nc-muted)] hover:bg-[var(--nc-surface-hover)]'",
    )
    .replace('border-steel-300', 'border-[var(--nc-border)]')
    .replace(/border-steel-50/g, 'border-[var(--nc-border-subtle)]')
    .replace(
      "active ? 'bg-brand-50 ring-1 ring-inset ring-brand-200' : 'hover:bg-steel-50'",
      "active ? 'bg-[var(--nc-surface-selected)] ring-1 ring-inset ring-[var(--nc-accent-line)]' : 'hover:bg-[var(--nc-surface-hover)]'",
    )
}

for (const [rel, pairs] of Object.entries(files)) {
  const fp = path.join(root, rel)
  let s = fs.readFileSync(fp, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) {
      console.warn('MISS', rel, a.slice(0, 60))
      continue
    }
    s = s.split(a).join(b)
  }
  fs.writeFileSync(fp, s)
  console.log('ok', rel)
}

{
  const fp = path.join(root, 'components/warehouse/RobotDetails.tsx')
  fs.writeFileSync(fp, patchRobotDetails(fs.readFileSync(fp, 'utf8')))
  console.log('ok RobotDetails')
}
{
  const fp = path.join(root, 'components/warehouse/WarehouseStats.tsx')
  fs.writeFileSync(fp, patchWarehouseStats(fs.readFileSync(fp, 'utf8')))
  console.log('ok WarehouseStats')
}
