import { defineConfig, devices } from '@playwright/test'

/**
 * E2E against Docker frontend (:3000) by default, or local Vite (:5173).
 * Override: E2E_BASE_URL=http://localhost:5173 npm run test:e2e
 * First time: npx playwright install chromium
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
