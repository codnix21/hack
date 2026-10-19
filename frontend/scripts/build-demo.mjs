/**
 * Сборка UI для Docker nginx (:8910): VITE_API_URL=/api (same-origin proxy).
 * Запуск: npm run build:demo
 */
import { spawnSync } from 'node:child_process'
import process from 'node:process'

process.env.VITE_API_URL = '/api'

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, env: process.env })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

run('npx', ['tsc', '-b'])
run('npx', ['vite', 'build'])
console.log('build:demo ok — VITE_API_URL=/api → скопируйте/смонтируйте dist в nginx')
