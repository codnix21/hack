import { test, expect } from '@playwright/test'

test.describe('guest demo matching', () => {
  test('guest can open demo and run selection', async ({ page }) => {
    test.setTimeout(120_000)

    await page.goto('/')
    await page.getByRole('link', { name: /Войти/i }).click()
    await page.getByRole('button', { name: /Продолжить как гость/i }).click()
    await expect(page).toHaveURL(/\/app/, { timeout: 30_000 })
    await expect(page.getByText(/Гостевой/i).first()).toBeVisible({ timeout: 15_000 })

    await page.getByRole('link', { name: /Демонстрация/i }).first().click()
    await expect(page.getByText(/Демонстрационные проекты/i).first()).toBeVisible({
      timeout: 30_000,
    })
    await page.getByRole('button', { name: /^Открыть$/i }).first().click()
    await expect(page).toHaveURL(/\/app\/projects\/\d+/, { timeout: 30_000 })
    await expect(page.getByText(/Демонстрационный проект/i).first()).toBeVisible()

    await page.getByRole('button', { name: /^Подбор$/i }).click()
    const runMatch = page.getByRole('button', { name: /Запустить подбор|Обновить подбор/i })
    if (await runMatch.first().isVisible().catch(() => false)) {
      await runMatch.first().click()
    }
    await expect(
      page.getByText(/Подходит|Требует проверки|Не подходит|Подбор решений/i).first(),
    ).toBeVisible({ timeout: 90_000 })
  })
})
