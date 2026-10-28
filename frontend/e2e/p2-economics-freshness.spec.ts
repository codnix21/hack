import { test, expect } from '@playwright/test'
import { asGuest, clickStage, createWarehouseProject, stagesNav } from './helpers'

/**
 * P2 Scenario B — экономика KPI + freshness + блокировка экспорта.
 * Использует новый редактируемый проект (не read-only демо-оригинал).
 */
test.describe('P2 B economics freshness', () => {
  test('KPI row, stale after param change, export gate', async ({ page }) => {
    test.setTimeout(240_000)
    await asGuest(page)
    await createWarehouseProject(page, 'P2 economics freshness')

    const stages = stagesNav(page)
    await expect(stages).toBeVisible({ timeout: 30_000 })

    // Минимальные входы для расчёта (как в required-inputs.spec)
    const peak = page.locator('[data-param-field="peak_demand"] input').first()
    await expect(peak).toBeVisible({ timeout: 20_000 })
    await peak.fill('220')
    await peak.blur()
    await page.locator('[data-param-field="current_labor_cost_year"] input').first().fill('15000000')
    await page.locator('[data-param-field="unit_price"] input').first().fill('4000000')
    const save = page.getByRole('button', { name: /Сохранить параметры|^Сохранить$/i })
    await expect(save).toBeEnabled()
    await save.click()
    await expect(page.getByText(/сохранен/i).first()).toBeVisible({ timeout: 20_000 })

    await clickStage(page, /Подбор/i)
    const runMatch = page.getByRole('button', { name: /Запустить подбор|Обновить подбор/i }).first()
    if (await runMatch.isVisible().catch(() => false)) {
      await runMatch.click()
      await expect(
        page.getByText(/Подходит|Требует проверки|В фильтре:|решени/i).first(),
      ).toBeVisible({ timeout: 90_000 })
      const toEcon = page.getByRole('button', { name: /В расчёт/i }).first()
      if (await toEcon.isVisible().catch(() => false)) await toEcon.click()
    }

    await clickStage(page, /Экономика/i)
    const calc = page.getByRole('button', { name: /Рассчитать|Пересчитать/i }).first()
    await expect(calc).toBeVisible({ timeout: 30_000 })
    if (await calc.isEnabled().catch(() => false)) await calc.click()

    await expect(page.getByTestId('economics-kpi-row')).toBeVisible({ timeout: 90_000 })
    await expect(page.getByTestId('economics-freshness-badge')).toContainText(/Актуально/i, {
      timeout: 30_000,
    })
    const kpi = page.getByTestId('economics-kpi-row')
    await expect(kpi.getByText(/CAPEX|Капитал/i).first()).toBeVisible()
    await expect(kpi.getByText(/окуп|Payback/i).first()).toBeVisible()
    // OPEX/TCO в свёрнутом блоке «Ещё показатели» после declutter
    await kpi.getByText(/Ещё показатели/i).click()
    await expect(kpi.getByText(/OPEX|эксплуат/i).first()).toBeVisible()
    await expect(kpi.getByText(/TCO|Совокупн/i).first()).toBeVisible()

    await clickStage(page, /Данные/i)
    const labor = page.locator('[data-param-field="current_labor_cost_year"] input').first()
    await labor.fill('16000000')
    await labor.blur()
    await expect(save).toBeEnabled()
    await save.click()
    await expect(page.getByText(/сохранен/i).first()).toBeVisible({ timeout: 20_000 })

    // Пока не открыт economics panel (он может авто-пересчитать), stale виден в шапке/guidance
    await expect(page.getByText(/Экономика:\s*Требуется пересчёт/i).first()).toBeVisible({
      timeout: 45_000,
    })
    const pdf = page.getByRole('button', { name: /Скачать PDF|^PDF$/i }).first()
    await expect(pdf).toBeDisabled()

    await clickStage(page, /Экономика/i)
    // Панель при монтировании может авто-пересчитать; иначе — ручной пересчёт
    const badge = page.getByTestId('economics-freshness-badge')
    await expect(badge).toBeVisible({ timeout: 30_000 })
    const badgeText = (await badge.textContent()) || ''
    if (/требуется пересчёт/i.test(badgeText)) {
      await expect(page.getByTestId('economics-stale-banner')).toBeVisible()
      const recalc = page.getByRole('button', { name: /Рассчитать|Пересчитать/i }).first()
      await expect(recalc).toBeEnabled({ timeout: 15_000 })
      await recalc.click()
    }
    await expect(badge).toContainText(/Актуально/i, { timeout: 90_000 })
  })

  test('incomplete inputs show blocking callout', async ({ page }) => {
    test.setTimeout(180_000)
    await asGuest(page)
    await createWarehouseProject(page, 'P2 incomplete econ')
    await clickStage(page, /Экономика/i)
    await expect(page.getByTestId('economics-inputs-incomplete')).toBeVisible({ timeout: 45_000 })
    await expect(page.getByText(/Недостаточно данных для расчёта экономики/i)).toBeVisible()
  })
})
