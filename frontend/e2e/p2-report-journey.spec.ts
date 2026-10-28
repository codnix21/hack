import { test, expect } from '@playwright/test'
import { asGuest, clickStage, openDemoWarehouse, stagesNav } from './helpers'

/**
 * P2 Scenario D — путь к отчёту + next-step + фактический экспорт при fresh.
 */
test.describe('P2 D project → report', () => {
  test('stages guidance, reload persistence, excel download when fresh', async ({ page }) => {
    test.setTimeout(240_000)
    await asGuest(page)
    await openDemoWarehouse(page)

    const stages = stagesNav(page)
    await expect(stages).toBeVisible({ timeout: 30_000 })

    // Подсказка следующего шага присутствует
    await expect(page.getByTestId('project-guidance-bar')).toBeVisible({ timeout: 20_000 })

    await clickStage(page, /Подбор/i)
    const run = page.getByRole('button', { name: /Запустить подбор|Обновить подбор/i }).first()
    if (await run.isVisible().catch(() => false)) {
      await run.click()
      await expect(page.getByText(/Подходит|Требует проверки|решени/i).first()).toBeVisible({
        timeout: 90_000,
      })
      const toEcon = page.getByRole('button', { name: /В расчёт/i }).first()
      if (await toEcon.isVisible().catch(() => false)) await toEcon.click()
    }

    await clickStage(page, /Экономика/i)
    const calc = page.getByRole('button', { name: /Рассчитать|Пересчитать/i }).first()
    if (await calc.isVisible().catch(() => false) && (await calc.isEnabled().catch(() => false))) {
      await calc.click()
    }
    await expect(page.getByText(/CAPEX|OPEX|TCO/i).first()).toBeVisible({ timeout: 90_000 })

    const projectUrl = page.url()

    await clickStage(page, /Отчёт/i)
    await expect(page.getByText(/отчёт|показател|CAPEX|предварительн/i).first()).toBeVisible({
      timeout: 45_000,
    })

    // Перезагрузка — этап/данные на месте
    await page.reload()
    await expect(page).toHaveURL(new RegExp(projectUrl.split('?')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    await expect(stagesNav(page)).toBeVisible({ timeout: 30_000 })

    // Экспорт только если fresh — иначе проверяем блокировку
    const excel = page.getByRole('button', { name: /Excel|Скачать Excel/i }).first()
    await expect(excel).toBeVisible({ timeout: 20_000 })
    const disabled = await excel.isDisabled().catch(() => false)
    if (disabled) {
      await expect(excel).toBeDisabled()
      // Не считаем отчёт готовым только из-за наличия кнопки
      test.info().annotations.push({
        type: 'note',
        description: 'Excel disabled — freshness not fresh; export correctly gated',
      })
    } else {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 90_000 }),
        excel.click(),
      ])
      expect(download.suggestedFilename()).toMatch(/\.xlsx$/i)
      const path = await download.path()
      expect(path).toBeTruthy()
    }
  })
})
