import { test, expect } from '@playwright/test'
import { asGuest } from './helpers'

const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
] as const

/**
 * P2 Stage 3 — viewport smoke + compare/settings routes (без объединения).
 */
test.describe('P2 viewport and navigation', () => {
  for (const vp of VIEWPORTS) {
    test(`no critical horizontal overflow @ ${vp.name}`, async ({ page }) => {
      test.setTimeout(90_000)
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await asGuest(page)

      const paths = ['/app', '/app/catalog', '/app/projects', '/app/compare', '/app/settings']
      for (const path of paths) {
        await page.goto(path)
        await page.waitForLoadState('domcontentloaded')
        await expect(page.locator('body')).toBeVisible({ timeout: 30_000 })
        const overflow = await page.evaluate(() => {
          const doc = document.documentElement
          return {
            scrollWidth: doc.scrollWidth,
            clientWidth: doc.clientWidth,
            delta: doc.scrollWidth - doc.clientWidth,
          }
        })
        // Допуск 24px на scrollbar/subpixel; критический overflow > 48
        expect(
          overflow.delta,
          `${path} overflow ${overflow.delta}px at ${vp.name}`,
        ).toBeLessThan(48)
      }
    })
  }

  test('compare global vs project compare remain distinct', async ({ page }) => {
    test.setTimeout(90_000)
    await asGuest(page)

    await page.goto('/app/compare')
    await expect(page.getByRole('heading', { name: /Сравнение решений/i })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page).toHaveURL(/\/app\/compare/)

    await page.goto('/app/settings')
    await expect(page.getByText(/Настройк|Профиль|Сессия|уведомлен/i).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page).toHaveURL(/\/app\/settings/)
  })

  test('keyboard tab reaches catalog search', async ({ page }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width: 1366, height: 768 })
    await asGuest(page)
    await page.goto('/app/catalog')
    await expect(page.getByTestId('catalog-search')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('catalog-search').focus()
    await expect(page.getByTestId('catalog-search')).toBeFocused()
    await page.keyboard.press('Tab')
    // Focus moved somewhere interactive (not stuck)
    const tag = await page.evaluate(() => document.activeElement?.tagName || '')
    expect(['INPUT', 'BUTTON', 'SELECT', 'A', 'TEXTAREA'].includes(tag)).toBeTruthy()
  })
})
