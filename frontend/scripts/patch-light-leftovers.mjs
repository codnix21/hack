import fs from 'fs'

const files = [
  'src/pages/CatalogPage.tsx',
  'src/pages/ProjectWorkspacePage.tsx',
  'src/components/warehouse/WarehouseScene.tsx',
  'src/components/project/WarehouseLayoutEditor.tsx',
  'src/components/ui/Table.tsx',
  'src/components/ui/SearchableSelect.tsx',
  'src/components/ui/ToastHost.tsx',
  'src/components/project/EconomicsPanel.tsx',
  'src/components/project/AttentionPanel.tsx',
  'src/components/project/DataCompletenessPanel.tsx',
  'src/components/project/RequiredInputsBanner.tsx',
  'src/components/project/ObjectParamsForm.tsx',
  'src/components/project/ProjectGuidanceBar.tsx',
  'src/components/project/PresentationPanel.tsx',
  'src/components/project/ImportFlow.tsx',
  'src/components/project/FleetComparePanel.tsx',
  'src/pages/AdminPage.tsx',
  'src/pages/ComparePage.tsx',
  'src/pages/RobotDetailPage.tsx',
  'src/pages/DemoPage.tsx',
  'src/pages/HelpPage.tsx',
  'src/pages/SettingsPage.tsx',
]

const reps = [
  ['border-amber-200 bg-amber-50 text-amber-950', 'border-[rgba(245,193,74,0.4)] bg-[var(--nc-warning-soft)] text-[var(--nc-warning)]'],
  ['border-steel-200 bg-steel-50 text-steel-800', 'border-[var(--nc-border)] bg-[var(--nc-surface-muted)] text-[var(--nc-text)]'],
  ['border-b border-steel-200 bg-steel-50/80', 'border-b border-[var(--nc-border)] bg-[var(--nc-surface-muted)]'],
  ['border-b border-steel-200 bg-steel-50', 'border-b border-[var(--nc-border)] bg-[var(--nc-surface-muted)]'],
  ['bg-steel-50 text-xs uppercase text-steel-500', 'bg-[var(--nc-surface-muted)] text-xs uppercase text-[var(--nc-muted)]'],
  ['rounded border border-steel-200 bg-white', 'rounded border border-[var(--nc-border)] bg-[var(--nc-surface)]'],
  ['rounded border border-steel-100 bg-steel-50/60', 'rounded border border-[var(--nc-border-subtle)] bg-[var(--nc-surface-muted)]'],
  ['rounded border border-steel-100 bg-steel-50', 'rounded border border-[var(--nc-border-subtle)] bg-[var(--nc-surface-muted)]'],
  ['overflow-hidden rounded border border-steel-100 bg-steel-50', 'overflow-hidden rounded border border-[var(--nc-border-subtle)] bg-[var(--nc-surface-muted)]'],
  ['hover:bg-steel-50/80', 'hover:bg-[var(--nc-surface-hover)]'],
  ['hover:bg-steel-50', 'hover:bg-[var(--nc-surface-hover)]'],
  ['hover:bg-steel-100', 'hover:bg-[var(--nc-surface-hover)]'],
  ['bg-steel-50/60', 'bg-[var(--nc-surface-muted)]'],
  ['bg-steel-50/80', 'bg-[var(--nc-surface-muted)]'],
  ['bg-steel-50', 'bg-[var(--nc-surface-muted)]'],
  ['bg-white/95', 'bg-[var(--nc-surface)]/95'],
  ['bg-white shadow-sm', 'bg-[var(--nc-surface)] shadow-sm'],
  ['bg-white', 'bg-[var(--nc-surface)]'],
  ['border-amber-200 bg-amber-50', 'border-[rgba(245,193,74,0.4)] bg-[var(--nc-warning-soft)]'],
  ['border-amber-300 bg-amber-50', 'border-[rgba(245,193,74,0.4)] bg-[var(--nc-warning-soft)]'],
  ['text-amber-950', 'text-[var(--nc-warning)]'],
  ['text-amber-900', 'text-[var(--nc-warning)]'],
  ['text-amber-800', 'text-[var(--nc-warning)]'],
  ['text-amber-700', 'text-[var(--nc-warning)]'],
  ['text-emerald-700', 'text-[var(--nc-lime)]'],
  ['text-emerald-600', 'text-[var(--nc-lime)]'],
  ['border-orange-200', 'border-[var(--nc-accent-line)]'],
  ['border-steel-200', 'border-[var(--nc-border)]'],
  ['border-steel-300', 'border-[var(--nc-border-strong)]'],
  ['border-steel-100', 'border-[var(--nc-border-subtle)]'],
  ['text-steel-900', 'text-[var(--nc-ink)]'],
  ['text-steel-800', 'text-[var(--nc-ink)]'],
  ['text-steel-700', 'text-[var(--nc-text)]'],
  ['text-steel-600', 'text-[var(--nc-muted)]'],
  ['text-steel-500', 'text-[var(--nc-muted)]'],
  ['text-steel-400', 'text-[var(--nc-faint)]'],
  ['text-steel-300', 'text-[var(--nc-muted)]'],
  ['hover:bg-white', 'hover:bg-[var(--nc-surface-hover)]'],
  ['hover:text-steel-900', 'hover:text-[var(--nc-ink)]'],
  ['hover:text-steel-800', 'hover:text-[var(--nc-ink)]'],
  ['hover:border-steel-400', 'hover:border-[var(--nc-border-strong)]'],
]

for (const f of files) {
  if (!fs.existsSync(f)) {
    console.log('skip missing', f)
    continue
  }
  let s = fs.readFileSync(f, 'utf8')
  let n = 0
  for (const [a, b] of reps) {
    const c = s.split(a).length - 1
    if (c) {
      s = s.split(a).join(b)
      n += c
    }
  }
  fs.writeFileSync(f, s)
  console.log(f, n)
}
