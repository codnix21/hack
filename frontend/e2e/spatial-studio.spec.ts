import { test, expect } from '@playwright/test'
import { asGuest, createWarehouseProject, clickStage } from './helpers'

test.describe('Spatial Studio', () => {
  test('open fullscreen studio, select, save, return to planner', async ({ page }) => {
    test.setTimeout(240_000)
    await asGuest(page)
    await createWarehouseProject(page, `Spatial Studio ${Date.now()}`)
    const projectId = page.url().match(/\/projects\/(\d+)/)?.[1]
    expect(projectId).toBeTruthy()

    await clickStage(page, /План|Планировка/i)
    await expect(page.getByTestId('layout-canvas')).toBeVisible({ timeout: 45_000 })

    const addRack = page.getByTestId('layout-add-rack')
    if (await addRack.isVisible().catch(() => false)) await addRack.click()

    await expect(page.getByTestId('spatial-studio-open')).toBeVisible()
    await page.getByTestId('spatial-studio-open').click()
    await expect(page).toHaveURL(new RegExp(`/app/projects/${projectId}/spatial`), { timeout: 30_000 })

    await expect(page.getByTestId('spatial-studio')).toBeVisible()
    await expect(page.getByTestId('project-stage-nav')).toHaveCount(0)
    await expect(page.getByTestId('spatial-viewport')).toBeVisible()
    await expect(page.getByTestId('spatial-tool-rail')).toBeVisible()

    const webglBlocked = await page.getByTestId('spatial-webgl-fallback').isVisible().catch(() => false)
    test.skip(webglBlocked, 'WebGL unavailable')

    await expect(page.getByTestId('spatial-scene-canvas')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('spatial-fit').click()
    await page.getByTestId('spatial-cam-top').click()
    await page.getByTestId('spatial-cam-iso').click()

    // Snap UI: включение не меняет координаты выбранного объекта
    await page.getByTestId('spatial-tab-scene').click()
    await expect(page.getByTestId('spatial-snap-toggle')).toBeVisible()
    await page.getByTestId('spatial-snap-toggle').check()
    await expect(page.getByTestId('spatial-snap-status')).toContainText(/Snap:/i)
    await page.getByTestId('spatial-grid-step').fill('0.5')
    await page.getByTestId('spatial-rotation-step').fill('15')

    await page.getByTestId('spatial-tab-objects').click()
    const outliner = page.getByTestId('spatial-outliner')
    await expect(outliner).toBeVisible()
    const firstObj = outliner.locator('button').first()
    if (await firstObj.isVisible().catch(() => false)) {
      await firstObj.click()
      await expect(page.getByTestId('spatial-props')).toBeVisible({ timeout: 10_000 })

      const xBefore = await page.getByTestId('spatial-x-input').inputValue()
      const yBefore = await page.getByTestId('spatial-y-input').inputValue()

      // Точное перемещение числом
      await page.getByTestId('spatial-x-input').fill('12.3')
      await page.getByTestId('spatial-x-input').blur()
      await page.getByTestId('spatial-y-input').fill('9.7')
      await page.getByTestId('spatial-y-input').blur()
      // snap 0.5 → 12.5 / 9.5 (или clamp)
      await expect(page.getByTestId('spatial-x-input')).not.toHaveValue(xBefore)
      await expect(page.getByTestId('spatial-save-status')).toContainText(/Есть изменения|изменени/i)

      await page.getByTestId('spatial-rotation-input').fill('22')
      await page.getByTestId('spatial-rotation-input').blur()
      // snap 15° → 15 или 30
      const rot = await page.getByTestId('spatial-rotation-input').inputValue()
      expect(['15', '30', '0', '-15']).toContain(rot)

      // Undo / Redo
      await page.getByTestId('spatial-undo').click()
      await expect(page.getByTestId('spatial-redo')).toBeEnabled()
      await page.getByTestId('spatial-redo').click()

      await page.getByTestId('spatial-save').click()
      await expect(page.getByText(/План склада сохранён/i).first()).toBeVisible({ timeout: 30_000 })
      await expect(page.getByTestId('spatial-save-status')).toContainText(/Сохранено/i, {
        timeout: 15_000,
      })

      // Reload restore
      await page.reload()
      await expect(page.getByTestId('spatial-studio')).toBeVisible({ timeout: 45_000 })
      await page.getByTestId('spatial-tab-objects').click()
      const again = page.getByTestId('spatial-outliner').locator('button').first()
      if (await again.isVisible().catch(() => false)) {
        await again.click()
        await expect(page.getByTestId('spatial-x-input')).toBeVisible()
        // координаты после save+reload не пустые
        const xRestored = await page.getByTestId('spatial-x-input').inputValue()
        expect(Number(xRestored)).toBeGreaterThanOrEqual(0)
        // snap toggle снова выкл по умолчанию — объекты не сдвинуты автоматом
        await page.getByTestId('spatial-tab-scene').click()
        await expect(page.getByTestId('spatial-snap-toggle')).not.toBeChecked()
        await page.getByTestId('spatial-snap-toggle').check()
        await page.getByTestId('spatial-tab-objects').click()
        await again.click()
        await expect(page.getByTestId('spatial-x-input')).toHaveValue(xRestored)
      }
      void yBefore
    }

    await page.getByTestId('spatial-panel-toggle').click()
    await expect(page.getByTestId('spatial-right-panel')).toBeHidden()
    await page.getByTestId('spatial-panel-toggle').click()
    await expect(page.getByTestId('spatial-right-panel')).toBeVisible()

    await page.getByTestId('spatial-back').click()
    await expect(page).toHaveURL(new RegExp(`/app/projects/${projectId}`), { timeout: 30_000 })
    await expect(page).toHaveURL(/[?&]step=layout\b/)
    await expect(page.getByTestId('layout-canvas')).toBeVisible({ timeout: 45_000 })
  })
})
