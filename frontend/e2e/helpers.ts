import { expect, type Page } from '@playwright/test'

/** Гостевой вход с главной или /login. */
export async function asGuest(page: Page) {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: /Продолжить как гость/i })).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: /Продолжить как гость/i }).click()
  await expect(page).toHaveURL(/\/app/, { timeout: 45_000 })
}

/** Демо-вход администратора (ENVIRONMENT=demo). */
export async function asDemoAdmin(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/Электронная почта/i).fill('admin@demo.local')
  await page.getByLabel(/^Пароль$/i).fill('Admin123!')
  await page.locator('form').getByRole('button', { name: /^Войти$/i }).click()
  await expect(page).toHaveURL(/\/app/, { timeout: 45_000 })
}

export async function createWarehouseProject(page: Page, name: string) {
  await page.goto('/app/projects/new')
  await expect(page.getByText(/Какой объект вы оцениваете/i)).toBeVisible({ timeout: 20_000 })
  await page.locator('button').filter({ hasText: /Склад/i }).first().click()
  await page.getByRole('button', { name: /^Далее$/i }).click()
  await page.getByLabel(/Название проекта/i).fill(name)
  await page.getByLabel(/Регион/i).fill('Москва')
  await page.getByLabel(/Режим работы/i).selectOption('24x7')
  await page.getByRole('button', { name: /Создать и перейти к данным/i }).click()
  await expect(page).toHaveURL(/\/app\/projects\/\d+/, { timeout: 45_000 })
}

export function stagesNav(page: Page) {
  return page.getByRole('navigation', { name: /Этапы проекта/i })
}

/** Short-лейбл этапа → ожидаемый `?step=` после перехода. */
const STAGE_STEP_HINTS: { label: RegExp; step: RegExp }[] = [
  { label: /Данные|Объект/i, step: /[?&]step=(object|params|import)\b/ },
  { label: /Подбор/i, step: /[?&]step=selection\b/ },
  { label: /Сравнение/i, step: /[?&]step=compare\b/ },
  { label: /План|Планировка/i, step: /[?&]step=layout\b/ },
  { label: /Экономика/i, step: /[?&]step=(economics|scenarios|fleet)\b/ },
  { label: /DES|Симуляция|Моделирование/i, step: /[?&]step=visualization\b/ },
  { label: /Отчёт|Отчет/i, step: /[?&]step=(report|results|presentation)\b/ },
]

/**
 * Выбор этапа в ProjectStageNav.
 * Desktop: button по accessible name (aria-label «N. Short: статус»).
 * Narrow: #project-stage-select.
 * После клика ждём смену `?step=` — без этого тест не считается прошедшим переход.
 */
export async function clickStage(page: Page, label: RegExp) {
  const stages = stagesNav(page)
  await expect(stages).toBeVisible({ timeout: 30_000 })

  const samples = [
    'Данные',
    'Объект',
    'Подбор',
    'Сравнение',
    'План',
    'Планировка',
    'Экономика',
    'DES',
    'Симуляция',
    'Моделирование',
    'Отчёт',
    'Отчет',
  ]
  const stepRe = STAGE_STEP_HINTS.find((h) =>
    samples.some((s) => label.test(s) && h.label.test(s)),
  )?.step

  const mobile = stages.locator('#project-stage-select')
  if (await mobile.isVisible().catch(() => false)) {
    const options = await mobile.locator('option').allTextContents()
    const opt = options.find((t) => label.test(t))
    expect(opt, `mobile stage option matching ${label}`).toBeTruthy()
    await mobile.selectOption({ label: opt! })
  } else {
    const btn = stages.getByRole('button', { name: label })
    await expect(btn.first()).toBeVisible({ timeout: 15_000 })
    await btn.first().click()
  }

  if (stepRe) {
    await expect(page).toHaveURL(stepRe, { timeout: 20_000 })
  }
}

/** Открыть редактируемую копию демо-склада (не read-only оригинал). */
export async function openDemoWarehouse(page: Page) {
  await page.goto('/app/demo')
  await expect(page.getByRole('heading', { name: /Примеры проектов/i })).toBeVisible({
    timeout: 30_000,
  })
  // DemoPage: карточки <article>; гость — «Копия для редактирования», админ — «Клонировать»
  const row = page
    .locator('article')
    .filter({ hasText: /склад|Автоматизация|пример|Демо/i })
    .filter({
      has: page.getByRole('button', {
        name: /Копия для редактирования|Клонировать|Создать копию|Копир/i,
      }),
    })
    .first()
  await expect(row).toBeVisible({ timeout: 30_000 })
  await row
    .getByRole('button', {
      name: /Копия для редактирования|Клонировать|Создать копию|Копир|Сделать копию/i,
    })
    .click()
  await expect(page).toHaveURL(/\/app\/projects\/\d+/, { timeout: 45_000 })
}

/** Создать склад и заполнить ключевые числовые параметры для экономики. */
export async function seedWarehouseParams(page: Page) {
  const width = page.getByLabel(/Ширина площадки/i).first()
  if (await width.isVisible().catch(() => false)) {
    if (await width.isEnabled().catch(() => false)) {
      await width.fill('50')
      await page.getByLabel(/Длина площадки/i).first().fill('40')
    }
  }
  const labor = page.getByLabel(/Стоимость труда|фонд оплаты|ФОТ/i).first()
  if (await labor.isVisible().catch(() => false) && (await labor.isEnabled().catch(() => false))) {
    await labor.fill('12000000')
  }
  const peak = page.getByLabel(/Пиков(ый спрос|ая нагрузка)/i).first()
  if (await peak.isVisible().catch(() => false) && (await peak.isEnabled().catch(() => false))) {
    await peak.fill('180')
  }
  const save = page.getByRole('button', { name: /Сохранить параметры|^Сохранить$/i })
  if (await save.isEnabled().catch(() => false)) {
    await save.click()
    await expect(page.getByText(/сохранен/i).first()).toBeVisible({ timeout: 20_000 })
  }
}
