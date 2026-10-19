import { test, expect } from '@playwright/test'

/**
 * Продуктовый путь: логин гостем → демо-склад → этапы → экономика → отчёт → Excel.
 */
test.describe('product journey', () => {
  test('guest demo warehouse to report and excel export', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /Продолжить как гость/i }).click()
    await page.waitForURL(/\/app/, { timeout: 30_000 })

    await page.goto('/app/demo')
    await expect(page.getByText(/Автоматизация склада/i).first()).toBeVisible({ timeout: 25_000 })

    await page
      .locator('article')
      .filter({ hasText: /склад/i })
      .getByRole('button', { name: /^Открыть$/i })
      .click()

    await page.waitForURL(/\/app\/projects\/\d+/, { timeout: 45_000 })
    await expect(page.getByRole('navigation', { name: /Этапы проекта/i })).toBeVisible({
      timeout: 20_000,
    })

    const stages = page.getByRole('navigation', { name: /Этапы проекта/i })
    await stages.getByRole('button', { name: /Подбор/i }).click()
    const runMatch = page.getByRole('button', { name: /Запустить подбор/i })
    await expect(runMatch).toBeVisible({ timeout: 15_000 })
    await runMatch.click()
    await expect(page.getByText(/Подходит|Требует проверки|подходящих/i).first()).toBeVisible({
      timeout: 90_000,
    })

    await stages.getByRole('button', { name: /Экономика/i }).click()
    const calc = page.getByRole('button', { name: /Рассчитать экономику|Пересчитать сценарии/i }).first()
    if (await calc.isVisible({ timeout: 8000 }).catch(() => false)) {
      await calc.click()
    }
    await expect(page.getByText(/CAPEX/i).first()).toBeVisible({ timeout: 90_000 })

    await stages.getByRole('button', { name: /Отчёт/i }).click()
    await expect(page.getByText(/предварительн|руковод|отчёт/i).first()).toBeVisible({
      timeout: 25_000,
    })

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 90_000 }),
      page.getByRole('button', { name: /Скачать Excel|Экспорт Excel/i }).first().click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i)
  })
})
