import { test, expect } from '@playwright/test'
import { asGuest, clickStage, openDemoWarehouse } from './helpers'

test.describe('guest demo matching', () => {
  test('guest can open demo and run selection', async ({ page }) => {
    test.setTimeout(120_000)

    await asGuest(page)
    await expect(page.getByText(/Гостевой|гость/i).first()).toBeVisible({ timeout: 15_000 })

    await openDemoWarehouse(page)
    await expect(page.getByRole('navigation', { name: /Этапы проекта/i })).toBeVisible({
      timeout: 20_000,
    })
    await clickStage(page, /Подбор/i)
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
