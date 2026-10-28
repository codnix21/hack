import { test, expect } from '@playwright/test'
import { asGuest, createWarehouseProject } from './helpers'

/**
 * P2 Scenario A — каталог → фильтры / empty / карточка → «В расчёт» в проект.
 * Требует живой backend с каталогом (не page.route моки на API, кроме теста ошибки).
 */
test.describe('P2 A catalog → selection context', () => {
  test('search, filter reset, empty state, compare vs project context', async ({ page }) => {
    test.setTimeout(180_000)
    await asGuest(page)
    await createWarehouseProject(page, `P2 catalog ctx ${Date.now()}`)
    const projectId = page.url().match(/\/projects\/(\d+)/)?.[1]
    expect(projectId).toBeTruthy()

    await page.goto('/app/catalog')
    await expect(
      page.getByRole('heading', { name: /Каталог решений|Оборудование|Каталог роботов|^Каталог$/i }),
    ).toBeVisible({
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
    await expect(page.locator('table.nc-table tbody tr').first()).toBeVisible({
      timeout: 45_000,
    })
    await page.getByRole('button', { name: /Карточка|Открыть карточку/i }).first().click()
    await expect(page).toHaveURL(/\/app\/catalog\/\d+/, { timeout: 20_000 })

    // Callout: Сравнить / к сравнению ≠ В расчёт
    await expect(page.getByText(/Сравнение\s*≠\s*расчёт|сравнен.*расчёт/i).first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('button', { name: /К сравнению/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /В расчёт \(проект\)/i })).toBeVisible()

    await page.getByRole('button', { name: /В расчёт \(проект\)/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: /Назначить в расчёт/i })).toBeVisible({
      timeout: 15_000,
    })
    const projectSelect = dialog.getByRole('combobox', { name: /Проект/i })
    await expect(projectSelect).toBeVisible({ timeout: 20_000 })
    await projectSelect.selectOption(String(projectId))
    await expect(dialog.getByRole('button', { name: /^В расчёт$/i })).toBeEnabled({ timeout: 10_000 })
    await dialog.getByRole('button', { name: /^В расчёт$/i }).click()
    await expect(page).toHaveURL(new RegExp(`/app/projects/${projectId}`), { timeout: 30_000 })
    await expect(page).toHaveURL(/[?&]step=economics\b/)
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
