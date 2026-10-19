import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'

const xlsxPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  '_e2e_params_import.xlsx',
)

async function asGuest(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: /Продолжить как гость/i }).click()
  await page.waitForURL(/\/app/, { timeout: 30_000 })
}

test.describe('params Excel import', () => {
  test('preview validate confirm and reopen after reload', async ({ page }) => {
    test.setTimeout(180_000)
    await asGuest(page)

    await page.goto('/app/projects/new')
    await expect(page.getByText(/Какой объект вы оцениваете/i)).toBeVisible({ timeout: 20_000 })
    await page.locator('button').filter({ hasText: /Склад/i }).first().click()
    await page.getByRole('button', { name: /^Далее$/i }).click()
    await page.getByLabel(/Название проекта/i).fill('Импорт Excel E2E')
    await page.getByRole('button', { name: /Создать и перейти к данным/i }).click()
    await page.waitForURL(/\/app\/projects\/\d+/, { timeout: 45_000 })

    await page.locator('.border-b').getByRole('button', { name: /^Импорт Excel$/i }).click()
    await expect(page.getByTestId('import-flow')).toBeVisible({ timeout: 15_000 })

    await page.getByTestId('import-file-input').setInputFiles(xlsxPath)
    await expect(page.getByTestId('import-file-meta')).toContainText(/\.xlsx/i)
    await page.getByTestId('import-preview-btn').click()

    await expect(page.getByText(/Распознанные значения|распознано:/i).first()).toBeVisible({
      timeout: 45_000,
    })
    await page.getByTestId('import-validate-btn').click()
    await expect(
      page.getByText(/Итоговая сводка|Распознано параметров|Будут перезаписаны/i).first(),
    ).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('import-confirm-btn').click()
    await expect(page.getByText(/успешно импортированы/i)).toBeVisible({ timeout: 30_000 })

    await page.reload()
    await page.locator('.border-b').getByRole('button', { name: /^Параметры$/i }).click()
    await expect(page.getByLabel(/Пиков(ый спрос|ая нагрузка)/i).first()).toHaveValue(/420/)
  })
})
