import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Регрессия P2: абсолютный localhost:8000 ломал локальный E2E/dev при backend на :8010.
 * Дефолт должен быть same-origin `/api` (Vite proxy / nginx).
 */
describe('api client base URL default', () => {
  it('defaults to relative /api when VITE_API_URL unset in module contract', () => {
    const src = readFileSync(path.join(process.cwd(), 'src/api/client.ts'), 'utf8')
    expect(src).toMatch(/VITE_API_URL\s*\|\|\s*['"]\/api['"]/)
    expect(src).not.toMatch(/localhost:8000/)
  })
})
