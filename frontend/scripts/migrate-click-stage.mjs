/** Replace stages.getByRole('button'...) with clickStage(page, ...) across e2e specs. */
import fs from 'node:fs'
import path from 'node:path'

const dir = path.resolve('frontend/e2e')
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.spec.ts'))

const clickRe =
  /await\s+stages(?:Nav\(page\))?\.getByRole\('button',\s*\{\s*name:\s*(\/[^/]+\/[a-z]*)\s*\}\)(?:\.first\(\))?\.click\(\)/g

for (const f of files) {
  const fp = path.join(dir, f)
  let s = fs.readFileSync(fp, 'utf8')
  const before = s

  s = s.replace(clickRe, 'await clickStage(page, $1)')

  if (s === before) {
    console.log('skip', f)
    continue
  }

  if (!s.includes('clickStage')) {
    console.warn('no clickStage import needed?', f)
  } else if (!/import\s*\{[^}]*clickStage/.test(s)) {
    s = s.replace(
      /import\s*\{([^}]+)\}\s*from\s*'\.\/helpers'/,
      (m, inner) => {
        if (inner.includes('clickStage')) return m
        const parts = inner.split(',').map((x) => x.trim()).filter(Boolean)
        parts.push('clickStage')
        return `import { ${parts.join(', ')} } from './helpers'`
      },
    )
  }

  fs.writeFileSync(fp, s)
  console.log('ok', f)
}
