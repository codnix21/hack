/** Reproducible WCAG contrast audit for NETCORE tokens. Node 18+. */
const pairs = [
  ['app-bg / primary', '#0a0c10', '#f2f4f8'],
  ['app-bg / secondary', '#0a0c10', '#c8d0de'],
  ['app-bg / muted', '#0a0c10', '#a8b2c4'],
  ['app-bg / faint', '#0a0c10', '#8b95a8'],
  ['surface / primary', '#1a2030', '#f2f4f8'],
  ['surface / secondary', '#1a2030', '#c8d0de'],
  ['surface / muted', '#1a2030', '#a8b2c4'],
  ['surface / faint', '#1a2030', '#8b95a8'],
  ['raised / primary', '#222a3a', '#f2f4f8'],
  ['raised / secondary', '#222a3a', '#c8d0de'],
  ['input / primary', '#121826', '#f2f4f8'],
  ['input / placeholder', '#121826', '#8b95a8'],
  ['accent btn / inverse', '#f07316', '#0a0c10'],
  ['lime / on bg', '#0a0c10', '#c6f23a'],
  ['warning / on bg', '#0a0c10', '#f5c14a'],
  ['danger / on bg', '#0a0c10', '#ff6b6b'],
  ['info / on bg', '#0a0c10', '#7aafff'],
  ['border / surface', '#1a2030', '#5c6d88'],
  ['border-strong / surface', '#1a2030', '#7a8aa3'],
  ['accent-soft text', '#1a2030', '#f07316'],
  ['link / surface', '#1a2030', '#ff9a4a'],
]

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

function lin(c) {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function lum(hex) {
  const [r, g, b] = hexToRgb(hex).map(lin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(a, b) {
  const L1 = lum(a)
  const L2 = lum(b)
  const hi = Math.max(L1, L2)
  const lo = Math.min(L1, L2)
  return (hi + 0.05) / (lo + 0.05)
}

console.log('NETCORE contrast audit (WCAG 2.2)')
console.log('pair'.padEnd(32), 'ratio'.padStart(6), 'AA text', 'AA large/UI(3:1)')
for (const [name, bg, fg] of pairs) {
  const r = ratio(bg, fg)
  const isBorder = name.startsWith('border')
  const aa = isBorder ? (r >= 3 ? 'n/a' : 'FAIL') : r >= 4.5 ? 'PASS' : 'FAIL'
  const large = r >= 3 ? 'PASS' : 'FAIL'
  console.log(name.padEnd(32), r.toFixed(2).padStart(6), String(aa).padStart(7), large.padStart(14))
}
