import { test, expect } from '@playwright/test'
import { asGuest } from './helpers'

/**
 * P2 Scenario A — каталог → фильтры / empty / контекст в проект.
 * Требует живой backend с каталогом (не page.route моки на API).
 */
test.describe('P2 A catalog → selection context', () => {
  test('search, filter reset, empty state, compare vs project context', async ({ page }) => {
    test.setTimeout(180_000)
    await asGuest(page)

    await page.goto('/app/catalog')
    await expect(page.getByRole('heading', { name: /Оборудование|Каталог роботов|^Каталог$/i })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByTestId('catalog-search')).toBeVisible()

    // Пустой результат
    await page.getByTestId('catalog-search').fill('zzz-no-such-robot-p2-e2e')
    await expect(page.getByTestId('catalog-empty')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/Решения не найдены/i)).toBeVisible()

    const reset = page.getByTestId('catalog-reset-filters')
    await expect(reset.first()).toBeVisible()
    await reset.first().click()
    await expect(page.getByTestId('catalog-empty')).toBeHidden({ timeout: 30_000 })

    // Реальный поиск: берём первую строку после загрузки
    await expect(page.locator('table.nc-table tbody tr, .page-surface button').first()).toBeVisible({
      timeout: 45_000,
    })

    // Callout: Сравнить ≠ В расчёт
    await expect(page.getByText(/Сравнить/i).first()).toBeVisible()
    await expect(page.getByText(/В расчёт/i).first()).toBeVisible()

    // Контекст «В проект»
    const projectBtn = page.getByRole('button', { name: /^В проект:/i }).first()
    await expect(projectBtn).toBeVisible({ timeout: 20_000 })
    await projectBtn.click()
    await expect(page).toHaveURL(/\/app\/projects/, { timeout: 20_000 })
    await expect(page.getByText(/Контекст из каталога|Из каталога|В расчёт/i).first()).toBeVisible({
      timeout: 15_000,
    })
    const focus = await page.evaluate(() => sessionStorage.getItem('nc_catalog_focus_robot_id'))
    expect(focus).toBeTruthy()
  })

  test('catalog list error shows ErrorState with safe retry', async ({ page }) => {
    test.setTimeout(90_000)
    await asGuest(page)

    let blockList = true
    // Список: GET /api/catalog?... — не перехватывать /catalog/stats|/meta|/compare|/id
    await page.route('**/api/catalog**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/\/$/, '')
      const isList = path === '/api/catalog' && route.request().method() === 'GET'
      if (blockList && isList) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'forced catalog failure' }),
        })
        return
      }
      await route.continue()
    })

    await page.goto('/app/catalog')
    await expect(page.getByTestId('error-state')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: /Повторить/i })).toBeVisible()
    blockList = false
    await page.getByRole('button', { name: /Повторить/i }).click()
    await expect(page.getByTestId('error-state')).toBeHidden({ timeout: 45_000 })
    await expect(page.getByTestId('catalog-search')).toBeVisible()
  })
})
