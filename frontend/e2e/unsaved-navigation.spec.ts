import { test, expect } from '@playwright/test'

async function asGuest(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: /Продолжить как гость/i }).click()
  await page.waitForURL(/\/app/, { timeout: 30_000 })
}

test.describe('unsaved params SPA guard', () => {
  test('dirty params block leave; discard allows navigation', async ({ page }) => {
    test.setTimeout(180_000)
    await asGuest(page)

    await page.goto('/app/projects/new')
    await expect(page.getByText(/Какой объект вы оцениваете/i)).toBeVisible({ timeout: 20_000 })
    await page.locator('button').filter({ hasText: /Склад/i }).first().click()
    await page.getByRole('button', { name: /^Далее$/i }).click()
    await page.getByLabel(/Название проекта/i).fill('Unsaved nav E2E')
    await page.getByRole('button', { name: /Создать и перейти к данным/i }).click()
    await page.waitForURL(/\/app\/projects\/\d+/, { timeout: 45_000 })

    const peak = page.getByLabel(/Пиков(ый спрос|ая нагрузка)/i).first()
    await expect(peak).toBeVisible({ timeout: 20_000 })
    await peak.fill('777')
    await expect(page.getByText(/Есть несохранённые изменения/i)).toBeVisible({ timeout: 10_000 })

    const mainNav = page.getByRole('navigation', { name: /Основное меню/i })
    await mainNav.getByRole('link', { name: /Проекты/i }).click()
    await expect(page.getByTestId('unsaved-guard-dialog')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('unsaved-stay').click()
    await expect(page.getByTestId('unsaved-guard-dialog')).toHaveCount(0)
    await expect(page).toHaveURL(/\/app\/projects\/\d+/)

    await mainNav.getByRole('link', { name: /Каталог/i }).click()
    await expect(page.getByTestId('unsaved-guard-dialog')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('unsaved-discard').click()
    await expect(page).toHaveURL(/\/app\/catalog/, { timeout: 15_000 })
  })
})
