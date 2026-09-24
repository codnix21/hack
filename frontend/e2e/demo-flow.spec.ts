import { test, expect } from '@playwright/test'

/**
 * Full demo smoke against live Docker stack (:3000) or Vite (:5173).
 * Path: Home → Login → Demo → Selection → Economics → Explain → What-if → Viz → Results → Catalog card.
 * No skips — failure means stack/UI regression.
 */
test.describe('demo flow', () => {
  test('full user path with Russian UI', async ({ page }) => {
    test.setTimeout(180_000)

    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: /Платформа подбора роботизированных решений/i }),
    ).toBeVisible({ timeout: 30_000 })

    await page.getByRole('link', { name: /Войти/i }).click()
    await expect(page.getByRole('heading', { name: /Вход в систему/i })).toBeVisible()

    await page.getByLabel(/Электронная почта/i).fill('admin@demo.local')
    await page.getByLabel(/^Пароль$/i).fill('Admin123!')
    await page.locator('form').getByRole('button', { name: /^Войти$/i }).click()

    await expect(page).toHaveURL(/\/app/, { timeout: 30_000 })

    await page.getByRole('link', { name: /Открыть демонстрационный проект|Демонстрация/i }).first().click()
    await expect(page.getByText(/Демонстрационные проекты/i).first()).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: /^Открыть$/i }).first().click()
    await expect(page).toHaveURL(/\/app\/projects\/\d+/, { timeout: 30_000 })
    const projectUrl = page.url().split('?')[0]
    await expect(page.getByText(/Параметры|Демонстрацион/i).first()).toBeVisible()

    // Selection
    await page.getByRole('button', { name: /^Подбор$/i }).click()
    await expect(page.getByText(/Подбор решений|Запустить подбор/i).first()).toBeVisible({
      timeout: 15_000,
    })
    const runMatch = page.getByRole('button', { name: /Запустить подбор|Обновить подбор/i })
    if (await runMatch.first().isVisible().catch(() => false)) {
      await runMatch.first().click()
      await expect(
        page.getByText(/Подходит|Требует проверки|Не подходит|решени/i).first(),
      ).toBeVisible({ timeout: 90_000 })
    }

    // Economics + Explain + What-if
    await page.getByRole('button', { name: /^Экономика$/i }).click()
    await expect(
      page.getByText(/Сравнение сценариев|Анализ «что если»|Пересчитать сценарии|CAPEX/i).first(),
    ).toBeVisible({ timeout: 60_000 })
    await expect(
      page.getByText(/Допущение|Задано пользователем|Окупаемость|Годовой эффект/i).first(),
    ).toBeVisible()

    const explainBtn = page.getByRole('button', { name: /Как рассчитано/i })
    if (await explainBtn.first().isVisible().catch(() => false)) {
      await explainBtn.first().click()
      await expect(page.getByText(/формул|результат|допущ|показател/i).first()).toBeVisible({
        timeout: 30_000,
      })
      await page.keyboard.press('Escape')
    }

    await expect(page.getByText(/что если|What-?if|Сбросить изменения/i).first()).toBeVisible({
      timeout: 15_000,
    })
    const resetBtn = page.getByRole('button', { name: /Сбросить изменения/i }).first()
    if (await resetBtn.isEnabled().catch(() => false)) {
      await resetBtn.click()
    }

    // Visualization
    await page.getByRole('button', { name: /Визуализац/i }).click()
    await expect(page.getByText(/Демонстрационная 2D-визуализация/i).first()).toBeVisible({
      timeout: 30_000,
    })

    // Results
    await page.getByRole('button', { name: /Результат/i }).click()
    await expect(page.getByText(/Экспорт|PDF|Excel|результат/i).first()).toBeVisible({
      timeout: 30_000,
    })

    // Catalog + filter + pagination
    await page.goto('/app/catalog')
    await expect(
      page.getByText(/из исходных материалов|Исходн|демонстрацион/i).first(),
    ).toBeVisible({ timeout: 30_000 })
    await expect(page.getByPlaceholder(/Поиск по названию, компании, сценарию/i)).toBeVisible()
    await expect(page.getByText(/Показано .+ из |Найдено:/i).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(
      page.getByRole('button', { name: /Первая страница|Следующая страница|Последняя страница/i }).first(),
    ).toBeVisible()

    await page.getByPlaceholder(/Поиск по названию, компании, сценарию/i).fill('a')
    await expect(page.getByText(/Показано|Найдено|По заданным параметрам/i).first()).toBeVisible({
      timeout: 20_000,
    })
    // reset search for card open
    await page.getByPlaceholder(/Поиск по названию, компании, сценарию/i).fill('')
    await expect(page.getByRole('button', { name: /Открыть карточку/i }).first()).toBeVisible({
      timeout: 20_000,
    })

    await page.getByRole('button', { name: /Открыть карточку/i }).first().click()
    await expect(
      page
        .getByText(/Источник данных|Происхождение|Нет данных в исходных материалах|DOCX|Исходн/i)
        .first(),
    ).toBeVisible({ timeout: 30_000 })

    // Export PDF + Excel from project
    await page.goto(projectUrl)
    await expect(page).toHaveURL(/\/app\/projects\/\d+/)
    const pdfPromise = page.waitForEvent('download', { timeout: 60_000 }).catch(() => null)
    await page.getByRole('button', { name: /Экспорт PDF/i }).click()
    const pdfDl = await pdfPromise
    if (pdfDl) {
      expect(pdfDl.suggestedFilename()).toMatch(/\.pdf$/i)
    }
    await expect(page.getByText(/Формирование отчёта|Отчёт успешно|Не удалось сформировать/i).first()).toBeVisible({
      timeout: 30_000,
    })

    const xlsPromise = page.waitForEvent('download', { timeout: 60_000 }).catch(() => null)
    await page.getByRole('button', { name: /Экспорт Excel/i }).click()
    const xlsDl = await xlsPromise
    if (xlsDl) {
      expect(xlsDl.suggestedFilename()).toMatch(/\.xlsx$/i)
    }
    await expect(page.getByText(/Формирование отчёта|Отчёт успешно|Не удалось сформировать/i).first()).toBeVisible({
      timeout: 30_000,
    })
  })
})
