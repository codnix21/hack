import { test, expect } from '@playwright/test'
import { asGuest, createWarehouseProject, openDemoWarehouse, stagesNav, clickStage } from './helpers'

/**
 * P2 Scenario C — планировщик + DES mismatch без автоправки.
 */
test.describe('P2 C planner and DES', () => {
  test('canvas, inspector, narrow viewport read-only', async ({ page }) => {
    test.setTimeout(180_000)
    await asGuest(page)
    await createWarehouseProject(page, 'P2 planner viewport')

    const stages = stagesNav(page)
    await clickStage(page, /План|Планировка/i)
    await expect(page.getByTestId('layout-canvas')).toBeVisible({ timeout: 45_000 })
    await expect(page.getByTestId('layout-tool-pan')).toBeVisible()

    // Desktop: редактирование доступно
    await page.setViewportSize({ width: 1920, height: 1080 })
    await expect(page.getByTestId('layout-add-rack')).toBeVisible()
    await expect(page.getByTestId('layout-tool-route')).toBeVisible()

    // Узкий viewport — режим просмотра
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByTestId('layout-mobile-hint')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('layout-tool-route')).toHaveCount(0)
    await expect(page.getByTestId('layout-add-rack')).toHaveCount(0)
    await expect(page.getByTestId('layout-tool-pan')).toBeVisible()
  })

  test('DES shows robots mismatch without auto-align', async ({ page }) => {
    test.setTimeout(240_000)
    await asGuest(page)
    await openDemoWarehouse(page)
    const stages = stagesNav(page)

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
    if (await calc.isVisible().catch(() => false)) {
      if (await calc.isEnabled().catch(() => false)) await calc.click()
      await expect(page.getByText(/CAPEX|OPEX|TCO/i).first()).toBeVisible({ timeout: 90_000 })
    }

    await clickStage(page, /План|Планировка/i)
    // Если план пуст — добавим стеллаж чтобы DES имел геометрию
    const addRack = page.getByTestId('layout-add-rack')
    if (await addRack.isVisible().catch(() => false)) {
      await addRack.click()
      await page.getByTestId('layout-save').click()
      await expect(page.getByText(/сохранён/i).first()).toBeVisible({ timeout: 20_000 })
    }

    await clickStage(page, /DES|Симуляция|Моделирование/i)
    await expect(page.getByTestId('warehouse-scene')).toBeVisible({ timeout: 90_000 })

    const countInput = page.getByTestId('sim-robots-count')
    await expect(countInput).toBeVisible({ timeout: 30_000 })
    await countInput.fill('20')
    const start = page.getByRole('button', { name: /Запустить симуляцию/i })
    if (await start.isEnabled().catch(() => false)) {
      await start.click()
    }
    await expect(page.getByTestId('sim-robots-mismatch')).toBeVisible({ timeout: 30_000 })

    // Значение в поле не должно само сброситься к visible subset
    await expect(countInput).toHaveValue('20')
  })

  test('empty layout does not claim ready success', async ({ page }) => {
    test.setTimeout(120_000)
    await asGuest(page)
    await createWarehouseProject(page, 'P2 empty layout status')
    const stages = stagesNav(page)
    await clickStage(page, /План|Планировка/i)
    await expect(page.getByTestId('layout-canvas')).toBeVisible({ timeout: 45_000 })
    // Guidance / status should not say layout ready without objects (idle/warning ok)
    const readyClaim = page.getByText(/Планировка.*готов|План.*готов к симуляции/i)
    // Soft check: if guidance mentions plan, it should not be purely "ready" without objects
    const guidance = page.getByTestId('project-guidance-bar')
    if (await guidance.isVisible().catch(() => false)) {
      const t = (await guidance.textContent()) || ''
      expect(t.toLowerCase()).not.toMatch(/план[а-я]*\s+готов(?!ьте)/)
    }
    await expect(readyClaim).toHaveCount(0)
  })
})
