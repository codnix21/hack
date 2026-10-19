import { test, expect } from '@playwright/test'

test.describe('guest demo matching', () => {
  test('guest can open demo and run selection', async ({ page }) => {
    test.setTimeout(120_000)

    await page.goto('/')
    await page.getByRole('link', { name: /Войти/i }).click()
    await page.getByRole('button', { name: /Продолжить как гость/i }).click()
    await expect(page).toHaveURL(/\/app/, { timeout: 30_000 })
    await expect(page.getByText(/Гостевой|гость/i).first()).toBeVisible({ timeout: 15_000 })

    await page.getByRole('navigation', { name: /Основное меню/i }).getByRole('link', { name: /Демонстрация/i }).click()
    await expect(page.getByText(/Демонстрационные проекты/i).first()).toBeVisible({
      timeout: 30_000,
    })
    await page
      .locator('article')
      .filter({ hasText: /склад/i })
      .getByRole('button', { name: /^Открыть$/i })
      .click()
    await expect(page).toHaveURL(/\/app\/projects\/\d+/, { timeout: 45_000 })
    await expect(page.getByText(/^Демо$/i).first()).toBeVisible({ timeout: 20_000 })
    const sessionDisclosure = page.getByText(/О сессии и демо-режиме/i)
    if (await sessionDisclosure.isVisible().catch(() => false)) {
      await sessionDisclosure.click()
      await expect(page.getByText(/только просмотр|Гостевая сессия|демо-проект/i).first()).toBeVisible({
        timeout: 10_000,
      })
    }

    const stages = page.getByRole('navigation', { name: /Этапы проекта/i })
    await stages.getByRole('button', { name: /Подбор/i }).click()
    const runMatch = page.getByRole('button', { name: /Запустить подбор|Обновить подбор/i })
    if (await runMatch.first().isVisible().catch(() => false)) {
      await runMatch.first().click()
    }
    await expect(
      page
        .getByText(/Предварительно подходит|Требует проверки|Не подходит|Подбор/i)
        .first(),
    ).toBeVisible({ timeout: 90_000 })
  })
})
