/**
 * Сборка UI для Docker nginx (:8910): VITE_API_URL=/api (same-origin proxy).
 * Запуск: npm run build:demo
 * Сначала нужны зависимости: npm ci  (или npm install)
 */
import { spawnSync } from 'node:child_process'
import process from 'node:process'

process.env.VITE_API_URL = '/api'

const r = spawnSync('npm', ['run', 'build'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
})
if (r.status !== 0) process.exit(r.status ?? 1)

console.log('build:demo ok — VITE_API_URL=/api → dist готов для nginx')
