import { test, expect } from '@playwright/test'
import { asGuest, createWarehouseProject, clickStage } from './helpers'

test.describe('P2 layout 2D/3D toggle', () => {
  test('switches to 3D preview and back without losing canvas', async ({ page }) => {
    test.setTimeout(180_000)
    await asGuest(page)
    await createWarehouseProject(page, 'P2 layout 3D')
    await clickStage(page, /План|Планировка/i)

    await expect(page.getByTestId('layout-canvas')).toBeVisible({ timeout: 45_000 })
    await expect(page.getByTestId('layout-view-2d')).toBeVisible()
    await expect(page.getByTestId('layout-view-3d')).toBeVisible()

    const addRack = page.getByTestId('layout-add-rack')
    if (await addRack.isVisible().catch(() => false)) {
      await addRack.click()
    }

    await page.getByTestId('layout-view-3d').click()
    await expect(page.getByTestId('layout-3d-preview').or(page.getByTestId('layout-3d-empty'))).toBeVisible({
      timeout: 30_000,
    })

    await page.getByTestId('layout-view-2d').click()
    await expect(page.getByTestId('layout-canvas')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('layout-tool-pan')).toBeVisible()
  })
})
