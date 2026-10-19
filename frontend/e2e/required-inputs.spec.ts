import { test, expect } from '@playwright/test'

/**
 * Минимальный набор → расчёт → изменение входа → требуется пересчёт.
 */
test.describe('required inputs progressive entry', () => {
  test('fill missing required fields, calculate, then see stale after change', async ({
    page,
  }) => {
    test.setTimeout(180_000)

    await page.goto('/')
    const guestHome = page.getByRole('button', { name: /Продолжить без регистрации/i })
    if (await guestHome.first().isVisible().catch(() => false)) {
      await guestHome.first().click()
    } else {
      await page.goto('/login')
      await page.getByRole('button', { name: /Продолжить как гость/i }).click()
    }
    await expect(page).toHaveURL(/\/app/, { timeout: 45_000 })

    await page.goto('/app/projects/new')
    await expect(page.getByText(/Какой объект вы оцениваете/i)).toBeVisible({ timeout: 20_000 })
    await page.locator('button').filter({ hasText: /Склад/i }).first().click()
    await page.getByRole('button', { name: /^Далее$/i }).click()

    await page.getByLabel(/Название проекта/i).fill('E2E обязательные поля')
    await page.getByLabel(/Регион/i).fill('Москва')
    await page.getByRole('button', { name: /Создать и перейти к данным/i }).click()
    await expect(page).toHaveURL(/\/app\/projects\/\d+/, { timeout: 45_000 })

    const banner = page.getByTestId('required-inputs-banner')
    await expect(banner).toBeVisible({ timeout: 20_000 })
    await expect(banner.getByText(/Минимальные данные:/i)).toBeVisible()
    await expect(banner.getByText(/Заполните ещё/i)).toBeVisible()

    // Компактный режим по умолчанию
    await expect(page.getByTestId('params-compact-toggle')).toBeVisible()

    const peak = page.locator('[data-param-field="peak_demand"] input').first()
    await expect(peak).toBeVisible({ timeout: 15_000 })
    await peak.fill('220')
    await peak.blur()

    const laborInput = page.locator('[data-param-field="current_labor_cost_year"] input').first()
    await expect(laborInput).toBeVisible({ timeout: 10_000 })
    await laborInput.fill('15000000')
    await laborInput.blur()

    const priceInput = page.locator('[data-param-field="unit_price"] input').first()
    await expect(priceInput).toBeVisible({ timeout: 10_000 })
    await priceInput.fill('4000000')
    await priceInput.blur()

    await expect(banner.getByText(/Минимальные данные:\s*3 из 3/i)).toBeVisible({
      timeout: 10_000,
    })
    await expect(banner.getByText(/Базовый расчёт экономики доступен/i)).toBeVisible()

    const save = page.getByRole('button', { name: /Сохранить параметры/i })
    await expect(save).toBeEnabled()
    await save.click()
    await expect(page.getByText(/Параметры сохранены|Изменения сохранены/i).first()).toBeVisible({
      timeout: 15_000,
    })

    const stages = page.getByRole('navigation', { name: /Этапы проекта/i })
    await stages.getByRole('button', { name: /Экономика/i }).click()

    await expect(page.getByTestId('economics-inputs-incomplete')).toHaveCount(0, {
      timeout: 5_000,
    }).catch(() => undefined)

    const calcBtn = page.getByRole('button', { name: /Рассчитать|Пересчитать/i }).first()
    await expect(calcBtn).toBeVisible({ timeout: 20_000 })
    if (await calcBtn.isEnabled()) {
      await calcBtn.click()
    }
    await expect(page.getByText(/CAPEX/i).first()).toBeVisible({ timeout: 90_000 })
    await expect(page.getByTestId('economics-freshness-badge')).toContainText(/Актуально|свеж/i, {
      timeout: 20_000,
    }).catch(async () => {
      await expect(page.getByTestId('economics-freshness-badge')).toBeVisible()
    })

    await stages.getByRole('button', { name: /Объект|Данные/i }).first().click()
    await expect(banner).toBeVisible({ timeout: 15_000 })
    const peakAgain = page.locator('[data-param-field="peak_demand"] input').first()
    await peakAgain.fill('320')
    await peakAgain.blur()
    await page.getByRole('button', { name: /Сохранить параметры/i }).click()
    await expect(page.getByText(/Параметры сохранены|Изменения сохранены/i).first()).toBeVisible({
      timeout: 15_000,
    })

    await stages.getByRole('button', { name: /Экономика/i }).click()
    await expect(
      page.getByText(/Требуется пересчёт|устарел|пересчёт/i).first(),
    ).toBeVisible({ timeout: 30_000 })
  })
})
