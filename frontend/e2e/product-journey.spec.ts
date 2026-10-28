import { test, expect } from '@playwright/test'
import { asGuest, clickStage, openDemoWarehouse } from './helpers'

/**
 * Продуктовый путь: гость → демо-склад → этапы → экономика → отчёт → Excel.
 */
test.describe('product journey', () => {
  test('guest demo warehouse to report and excel export', async ({ page }) => {
    test.setTimeout(180_000)
    await asGuest(page)
    await openDemoWarehouse(page)

    await expect(page.getByRole('navigation', { name: /Этапы проекта/i })).toBeVisible({
      timeout: 20_000,
    })

    await clickStage(page, /Подбор/i)
    const runMatch = page.getByRole('button', { name: /Запустить подбор|Обновить подбор/i })
    await expect(runMatch.first()).toBeVisible({ timeout: 15_000 })
    await runMatch.first().click()
    await expect(page.getByText(/Подходит|Требует проверки|подходящих|решени/i).first()).toBeVisible({
      timeout: 90_000,
    })

    await clickStage(page, /Экономика/i)
    const calc = page.getByRole('button', { name: /Рассчитать|Пересчитать/i }).first()
    if (await calc.isVisible({ timeout: 8000 }).catch(() => false) && (await calc.isEnabled())) {
      await calc.click()
    }
    await expect(page.getByText(/CAPEX/i).first()).toBeVisible({ timeout: 90_000 })

    await clickStage(page, /Отчёт/i)
    await expect(page.getByText(/предварительн|руковод|отчёт|CAPEX/i).first()).toBeVisible({
      timeout: 25_000,
    })

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 90_000 }),
      page.getByRole('button', { name: /Скачать Excel|Экспорт Excel|Excel/i }).first().click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i)
  })
})
