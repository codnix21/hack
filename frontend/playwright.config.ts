import { defineConfig, devices } from '@playwright/test'

/**
 * E2E against demo UI on Docker nginx (:8910) by default.
 * Dev Vite: E2E_BASE_URL=http://127.0.0.1:5173 npm run test:e2e
 * Before :8910: npm run build:demo && docker compose up -d frontend
 * First time: npx playwright install chromium
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:8910',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
