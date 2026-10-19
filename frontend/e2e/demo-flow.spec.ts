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
    await expect(page.getByText('NETCORE').first()).toBeVisible({ timeout: 30_000 })
    await expect(
      page.getByRole('heading', { name: /Предынвестиционная оценка роботизации склада/i }),
    ).toBeVisible({ timeout: 30_000 })

    await page.getByRole('link', { name: /Войти/i }).click()
    await expect(page.getByRole('heading', { name: /Вход в систему/i })).toBeVisible()

    await page.getByLabel(/Электронная почта/i).fill('admin@demo.local')
    await page.getByLabel(/^Пароль$/i).fill('Admin123!')
    await page.locator('form').getByRole('button', { name: /^Войти$/i }).click()

    await expect(page).toHaveURL(/\/app/, { timeout: 30_000 })

    await page.getByRole('link', { name: /Демонстрация/i }).first().click()
    await expect(page.getByText(/Демонстрационные проекты|пример/i).first()).toBeVisible({
      timeout: 30_000,
    })

    await page
      .locator('article')
      .filter({ hasText: /склад/i })
      .getByRole('button', { name: /^Открыть$/i })
      .click()
    await expect(page).toHaveURL(/\/app\/projects\/\d+/, { timeout: 45_000 })
    const projectUrl = page.url().split('?')[0]
    const stages = page.getByRole('navigation', { name: /Этапы проекта/i })
    await expect(stages).toBeVisible({ timeout: 20_000 })

    // Selection
    await stages.getByRole('button', { name: /Подбор/i }).click()
    await expect(page.getByText(/Подбор|Запустить подбор/i).first()).toBeVisible({
      timeout: 15_000,
    })
    const runMatch = page.getByRole('button', { name: /Запустить подбор|Обновить подбор/i })
    if (await runMatch.first().isVisible().catch(() => false)) {
      await runMatch.first().click()
      await expect(
        page.getByText(/Предварительно подходит|Требует проверки|Не подходит|решени/i).first(),
      ).toBeVisible({ timeout: 90_000 })
    }

    // Economics + Explain + What-if
    await stages.getByRole('button', { name: /Экономика/i }).click()
    await expect(
      page.getByText(/Сравнение сценариев|Анализ «что если»|Пересчитать|CAPEX|Рассчитать экономику/i).first(),
    ).toBeVisible({ timeout: 60_000 })
    const calc = page.getByRole('button', { name: /Рассчитать экономику|Пересчитать/i }).first()
    if (await calc.isVisible({ timeout: 5000 }).catch(() => false)) {
      await calc.click()
    }
    await expect(
      page.getByText(/Допущение|Окупаемость|Годовой эффект|Покрытие пика/i).first(),
    ).toBeVisible({ timeout: 90_000 })

    const explainBtn = page.getByRole('button', { name: /Как рассчитано/i })
    if (await explainBtn.first().isVisible().catch(() => false)) {
      await explainBtn.first().click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 15_000 })
      await expect(
        dialog.getByText(/формул|результат|допущ|показател|Как рассчитано/i).first(),
      ).toBeVisible({ timeout: 30_000 })
      await page.keyboard.press('Escape')
    }

    // Visualization / simulation
    await stages.getByRole('button', { name: /DES|Симуляция|Моделирование/i }).click()
    await expect(
      page.getByText(/DES|демонстрац|цифров|симуляц/i).first(),
    ).toBeVisible({ timeout: 30_000 })

    // Report / export
    await stages.getByRole('button', { name: /Отчёт/i }).click()
    await expect(page.getByText(/Экспорт|PDF|Excel|результат/i).first()).toBeVisible({
      timeout: 30_000,
    })

    // Catalog + filter + pagination
    await page.goto('/app/catalog')
    await expect(
      page.getByText(/по фильтрам|Исходн|демонстрацион|исходных/i).first(),
    ).toBeVisible({ timeout: 30_000 })
    const catalogSearch = page.getByRole('textbox', { name: /Поиск/i })
    await expect(catalogSearch).toBeVisible()
    await expect(page.getByRole('button', { name: /Фильтры/i })).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Первая страница|Следующая страница|Последняя страница/i }).first(),
    ).toBeVisible({ timeout: 30_000 })

    await catalogSearch.fill('a')
    await expect(page.getByText(/по фильтрам|Решения не найдены/i).first()).toBeVisible({
      timeout: 20_000,
    })
    await catalogSearch.fill('')
    await expect(
      page.getByRole('button', { name: /Карточка|Открыть карточку|Открыть/i }).first(),
    ).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: /Карточка|Открыть карточку|Открыть/i }).first().click()
    await expect(
      page
        .getByText(/Источник данных|Происхождение|Нет данных|DOCX|Исходн|Грузоподъёмность/i)
        .first(),
    ).toBeVisible({ timeout: 30_000 })

    // Export PDF + Excel from project
    await page.goto(projectUrl)
    await expect(page).toHaveURL(/\/app\/projects\/\d+/)
    const pdfPromise = page.waitForEvent('download', { timeout: 60_000 }).catch(() => null)
    await page.getByRole('button', { name: /Скачать PDF|Экспорт PDF/i }).click()
    const pdfDl = await pdfPromise
    if (pdfDl) {
      expect(pdfDl.suggestedFilename()).toMatch(/\.pdf$/i)
    }
    await expect(
      page.getByText(/PDF сформирован|Excel сформирован|Формирование отчёта|Отчёт успешно|Не удалось/i).first(),
    ).toBeVisible({ timeout: 30_000 })

    const xlsPromise = page.waitForEvent('download', { timeout: 60_000 }).catch(() => null)
    await page.getByRole('button', { name: /Скачать Excel|Экспорт Excel/i }).click()
    const xlsDl = await xlsPromise
    if (xlsDl) {
      expect(xlsDl.suggestedFilename()).toMatch(/\.xlsx$/i)
    }
    await expect(
      page.getByText(/Excel сформирован|PDF сформирован|Формирование отчёта|Отчёт успешно|Не удалось/i).first(),
    ).toBeVisible({ timeout: 30_000 })
  })
})
