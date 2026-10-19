import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const dxfPath = path.join(fixturesDir, 'sample_warehouse.dxf')

async function asGuest(page: import('@playwright/test').Page) {
  await page.goto('/')
  const guestHome = page.getByRole('button', { name: /Продолжить без регистрации/i })
  if (await guestHome.first().isVisible().catch(() => false)) {
    await guestHome.first().click()
  } else {
    await page.getByRole('link', { name: /Войти|Создать проект/i }).first().click()
    await page.getByRole('button', { name: /Продолжить как гость/i }).click()
  }
  await expect(page).toHaveURL(/\/app/, { timeout: 45_000 })
}

async function createWarehouseProject(page: import('@playwright/test').Page, name: string) {
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

test.describe('layout, simulation, reports', () => {
  test('add/move rack, DXF import, sim robots, export', async ({ page }) => {
    test.setTimeout(240_000)
    await asGuest(page)
    await createWarehouseProject(page, 'Отчёт демо склад Е2Е')

    // Параметры площади (синхронизируются с layout.width_m / length_m на backend)
    const width = page.getByLabel(/Ширина площадки/i).first()
    if (await width.isVisible().catch(() => false)) {
      await width.fill('50')
      await page.getByLabel(/Длина площадки/i).first().fill('40')
      await page.getByLabel(/Пиков(ый спрос|ая нагрузка)/i).first().fill('160')
      const saveParams = page.getByRole('button', { name: /Сохранить параметры|^Сохранить$/i })
      if (await saveParams.isEnabled().catch(() => false)) {
        await saveParams.click()
      }
    }

    // Планировка: размеры + стеллаж
    const stages = page.getByRole('navigation', { name: /Этапы проекта/i })
    await stages.getByRole('button', { name: /План|Планировка/i }).click()
    await expect(page.getByTestId('layout-add-rack')).toBeVisible({ timeout: 30_000 })
    const layoutW = page.getByLabel(/^Ширина, м$/i).first()
    await expect(layoutW).toBeVisible()
    await layoutW.fill('50')
    await page.getByLabel(/^Длина, м$/i).first().fill('40')
    await page.getByTestId('layout-add-rack').click()
    await expect(page.getByText(/Стеллаж/i).first()).toBeVisible()
    const xInput = page.getByLabel(/^X, м$/i)
    await expect(xInput).toBeVisible()
    await xInput.fill('15')
    await page.getByLabel(/^Y, м$/i).fill('8')
    await page.getByTestId('layout-save').click()
    await expect(page.getByText(/План склада сохранён|сохранён/i).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByTestId('layout-size-label')).toContainText(/50/)
    await expect(page.getByTestId('layout-size-label')).toContainText(/2[\s\u00a0]?000/)

    // DXF (точный заголовок превью — не путать с подзаголовком карточки)
    await page.getByTestId('layout-dxf-input').setInputFiles(dxfPath)
    await expect(
      page.getByText('Импорт DXF — предварительный просмотр', { exact: true }),
    ).toBeVisible({ timeout: 45_000 })
    await expect(page.getByTestId('layout-dxf-confirm')).toBeVisible()
    await page.getByTestId('layout-dxf-confirm').click()
    await expect(page.getByText(/Чертёж DXF применён/i).first()).toBeVisible({
      timeout: 45_000,
    })

    // Подбор + экономика (нужны для симуляции)
    await stages.getByRole('button', { name: /Подбор/i }).click()
    await page.getByRole('button', { name: /Запустить подбор/i }).first().click()
    await expect(
      page.getByText(/Предварительно подходит|Подходит|Требует проверки|В фильтре:|решени/i).first(),
    ).toBeVisible({ timeout: 90_000 })

    await stages.getByRole('button', { name: /Экономика/i }).click()
    const calcBtn = page.getByRole('button', { name: /Рассчитать|Пересчитать/i }).first()
    if (await calcBtn.isVisible().catch(() => false)) {
      await calcBtn.click()
      await expect(page.getByText(/CAPEX|NPV|OPEX/i).first()).toBeVisible({ timeout: 60_000 })
    }

    // Симуляция (aria-label: «Запустить симуляцию»)
    await stages.getByRole('button', { name: /DES|Симуляция|Моделирование/i }).click()
    const startSim = () => page.getByRole('button', { name: 'Запустить симуляцию' })
    await expect(startSim()).toBeVisible({ timeout: 90_000 })
    await expect(page.getByTestId('warehouse-scene')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('sim-robots-count')).toBeVisible({ timeout: 60_000 })
    // Поворот: явное ограничение в панели свойств
    await stages.getByRole('button', { name: /План|Планировка/i }).click()
    await page.getByTestId('layout-add-rack').click()
    await expect(page.getByTestId('layout-rotation-note')).toBeVisible()
    await stages.getByRole('button', { name: /DES|Симуляция|Моделирование/i }).click()

    await page.getByTestId('sim-robots-count').fill('4')
    await expect(page.getByTestId('sim-config-label')).toContainText(/4/)
    await expect(startSim()).toBeEnabled({ timeout: 30_000 })
    await startSim().click()
    await expect(page.getByTestId('sim-kpi-panel')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('sim-config-label')).toBeVisible()
    // пауза → сброс → снова запуск
    const pauseBtn = page.getByRole('button', { name: /^Пауза$/i }).first()
    if (await pauseBtn.isVisible().catch(() => false)) {
      await pauseBtn.click()
    }
    await page.getByRole('button', { name: 'Сбросить симуляцию' }).click()
    await expect(startSim()).toBeEnabled({ timeout: 30_000 })
    // 20 роботов — честный cap анимации (6 из 20)
    await page.getByTestId('sim-robots-count').fill('20')
    await expect(page.getByTestId('sim-config-label')).toContainText(/20/)
    await startSim().click()
    await expect(page.getByText(/на схеме 6 из 20|анимируется 6 из 20|из 20/i).first()).toBeVisible({
      timeout: 20_000,
    })
    await page.getByRole('button', { name: 'Сбросить симуляцию' }).click()
    await expect(startSim()).toBeEnabled({ timeout: 30_000 })
    // возврат в редактор — геометрия после DXF на месте (не «пустой» план)
    await stages.getByRole('button', { name: /План|Планировка/i }).click()
    const sizeAfterSim = await page.getByTestId('layout-size-label').textContent()
    expect(sizeAfterSim || '').toMatch(/Размер:\s*\d+/)
    await expect(page.getByTestId('layout-rotation-note').or(page.getByTestId('layout-add-rack'))).toBeVisible()
    await stages.getByRole('button', { name: /DES|Симуляция|Моделирование/i }).click()
    await page.getByTestId('sim-robots-count').fill('8')
    await expect(page.getByTestId('sim-config-label')).toContainText(/8/)
    await startSim().click()

    // Отчёты
    const [pdfDownload] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.getByRole('button', { name: /Скачать PDF|Экспорт PDF|Сформировать PDF/i }).first().click(),
    ])
    expect(pdfDownload.suggestedFilename()).toMatch(/\.pdf$/i)

    const [xlsxDownload] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.getByRole('button', { name: /Скачать Excel|Экспорт Excel|Excel/i }).first().click(),
    ])
    expect(xlsxDownload.suggestedFilename()).toMatch(/\.xlsx$/i)
  })
})
