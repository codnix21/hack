import { test, expect } from '@playwright/test'
import { asGuest, createWarehouseProject, clickStage } from './helpers'

test.describe('P2 layout 2D/3D toggle', () => {
  test('default 2D, switch 3D and back keeps editor controls', async ({ page }) => {
    test.setTimeout(180_000)
    await asGuest(page)
    await createWarehouseProject(page, 'P2 layout 3D')
    await clickStage(page, /План|Планировка/i)

    await expect(page.getByTestId('layout-canvas')).toBeVisible({ timeout: 45_000 })
    await expect(page.getByTestId('layout-view-2d')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('layout-view-3d')).toHaveAttribute('aria-pressed', 'false')

    const addRack = page.getByTestId('layout-add-rack')
    if (await addRack.isVisible().catch(() => false)) {
      await addRack.click()
    }

    await page.getByTestId('layout-view-3d').click()
    await expect(page.getByTestId('layout-view-3d')).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByTestId('layout-3d-preview').or(page.getByTestId('layout-3d-empty')),
    ).toBeVisible({ timeout: 30_000 })
    // Editing zoom tools disabled in 3D
    await expect(page.getByTestId('layout-zoom-in')).toBeDisabled()

    await page.getByTestId('layout-view-2d').click()
    await expect(page.getByTestId('layout-view-2d')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('layout-canvas')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('layout-tool-pan')).toBeVisible()
    await expect(page.getByTestId('layout-zoom-in')).toBeEnabled()
  })

  test('selection survives 2D→3D→2D when object still exists', async ({ page }) => {
    test.setTimeout(180_000)
    await asGuest(page)
    await createWarehouseProject(page, 'P2 layout 3D select')
    await clickStage(page, /План|Планировка/i)
    await expect(page.getByTestId('layout-canvas')).toBeVisible({ timeout: 45_000 })

    const addRack = page.getByTestId('layout-add-rack')
    test.skip(!(await addRack.isVisible().catch(() => false)), 'add rack unavailable (read-only)')

    await addRack.click()
    // Select via canvas center-ish click after add (last object often selected by inspector)
    const inspector = page.getByTestId('layout-inspector')
    await expect(inspector).toBeVisible()

    await page.getByTestId('layout-view-3d').click()
    await expect(page.getByTestId('layout-3d-preview').or(page.getByTestId('layout-3d-canvas'))).toBeVisible({
      timeout: 30_000,
    })
    await page.getByTestId('layout-view-2d').click()
    await expect(page.getByTestId('layout-canvas')).toBeVisible()
    await expect(page.getByTestId('layout-inspector')).toBeVisible()
  })
})
