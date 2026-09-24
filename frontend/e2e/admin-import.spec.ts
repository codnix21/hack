import { test, expect } from '@playwright/test'

test.describe('admin import history', () => {
  test('admin can open import materials and see batch history', async ({ page }) => {
    test.setTimeout(120_000)

    await page.goto('/login')
    await page.getByLabel(/Электронная почта/i).fill('admin@demo.local')
    await page.getByLabel(/^Пароль$/i).fill('Admin123!')
    await page.locator('form').getByRole('button', { name: /^Войти$/i }).click()
    await expect(page).toHaveURL(/\/app/, { timeout: 30_000 })

    await page.getByRole('link', { name: /Администрирование/i }).click()
    await expect(page.getByText(/Администрирование|Пользователи/i).first()).toBeVisible({
      timeout: 30_000,
    })

    await page.getByRole('button', { name: /Импорт материалов/i }).click()
    await expect(page.getByText(/Импорт материалов проекта|Каталог из CSV/i).first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('button', { name: /Импортировать каталог/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Импортировать датасеты/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Обогатить из DOCX/i })).toBeVisible()

    await expect(page.getByText(/История партий импорта/i).first()).toBeVisible()
    await expect(
      page.getByText(/Файл|Дата|Статус|Строк|Добавлено|Обновлено|Пропущено|Ошибк/i).first(),
    ).toBeVisible()
  })
})
