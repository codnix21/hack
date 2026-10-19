import { test, expect } from '@playwright/test'

/**
 * Критический путь демо заказчика (мастер создания + этапы продукта).
 * E2E_BASE_URL=http://127.0.0.1:8910
 */
test.describe('acceptance critical path', () => {
  test('guest creates project, matches, publishes, clone keeps original', async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000)

    await page.goto('/')
    await expect(page.getByText(/NETCORE|роботиз/i).first()).toBeVisible({ timeout: 30_000 })

    const guestHome = page.getByRole('button', { name: /Продолжить без регистрации/i })
    if (await guestHome.first().isVisible().catch(() => false)) {
      await guestHome.first().click()
    } else {
      await page.getByRole('link', { name: /Войти|Создать проект/i }).first().click()
      await page.getByRole('button', { name: /Продолжить как гость/i }).click()
    }
    await expect(page).toHaveURL(/\/app/, { timeout: 45_000 })

    await page.goto('/app/projects/new')
    // Шаг 1 мастера — тип объекта (кнопка-карточка, accessible name включает описание)
    await expect(page.getByText(/Какой объект вы оцениваете/i)).toBeVisible({ timeout: 20_000 })
    await page.locator('button').filter({ hasText: /Склад/i }).first().click()
    await page.getByRole('button', { name: /^Далее$/i }).click()

    await page.getByLabel(/Название проекта/i).fill('Приёмка E2E склад')
    await page.getByLabel(/Регион/i).fill('Москва')
    await page.getByLabel(/Режим работы/i).selectOption('24x7')

    await page.getByRole('button', { name: /Создать и перейти к данным/i }).click()
    await expect(page).toHaveURL(/\/app\/projects\/\d+/, { timeout: 45_000 })
    const projectUrl = page.url()
    const projectId = projectUrl.match(/projects\/(\d+)/)?.[1]
    expect(projectId).toBeTruthy()

    const peak = page.getByLabel(/Пиков(ый спрос|ая нагрузка)/i).first()
    if (await peak.isVisible().catch(() => false)) {
      await peak.fill('180')
      await peak.blur()
    }
    const save = page.getByRole('button', { name: /Сохранить параметры|^Сохранить$/i })
    // Кнопка видна всегда, но disabled без dirty — не ждать click на disabled
    if (await save.isEnabled().catch(() => false)) {
      await save.click()
      await expect(
        page.getByText(/Изменения сохранены|Сохранено|Параметры сохранены/i).first(),
      ).toBeVisible({
        timeout: 15_000,
      })
    }

    const stages = page.getByRole('navigation', { name: /Этапы проекта/i })
    await stages.getByRole('button', { name: /Подбор/i }).click()
    await page.getByRole('button', { name: /Запустить подбор/i }).first().click()
    await expect(page.getByText(/Подходит|В фильтре:/i).first()).toBeVisible({ timeout: 90_000 })

    await stages.getByRole('button', { name: /Отчёт/i }).click()
    await expect(page.getByText(/Ключевые показатели|CAPEX|предварительн/i).first()).toBeVisible({
      timeout: 60_000,
    })

    await page.getByRole('button', { name: /Опубликовать проект/i }).click()
    await expect(page.getByText(/Публичная ссылка|Скопировать ссылку/i).first()).toBeVisible({
      timeout: 30_000,
    })
    const linkText = await page.locator('text=/\\/p\\/[A-Za-z0-9_-]+/').first().textContent()
    const tokenMatch = linkText?.match(/\/p\/([A-Za-z0-9_-]+)/)
    expect(tokenMatch?.[1]).toBeTruthy()

    const publicPage = await context.newPage()
    await publicPage.goto(`/p/${tokenMatch![1]}`)
    await expect(publicPage.getByText(/только просмотр|Публичная/i).first()).toBeVisible({
      timeout: 30_000,
    })
    await publicPage.getByRole('button', { name: /Создать свою копию/i }).click()
    await expect(publicPage).toHaveURL(/\/app\/projects\/\d+/, { timeout: 45_000 })
    const cloneId = publicPage.url().match(/projects\/(\d+)/)?.[1]
    expect(cloneId).toBeTruthy()
    expect(cloneId).not.toBe(projectId)
    await publicPage.close()

    await page.goto(projectUrl.split('?')[0] + '?step=report')
    await expect(page.getByText(/Приёмка E2E склад/i).first()).toBeVisible({ timeout: 30_000 })
  })
})
