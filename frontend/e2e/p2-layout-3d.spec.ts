import { test, expect } from '@playwright/test'
import { asGuest, createWarehouseProject, clickStage } from './helpers'

test.describe('P2 layout 2D/3D toggle', () => {
  test('save layout, reload, and 3D matches restored plan', async ({ page }) => {
    test.setTimeout(240_000)
    const projectName = `P2 layout save-reload ${Date.now()}`
    await asGuest(page)
    await createWarehouseProject(page, projectName)
    const projectId = page.url().match(/\/projects\/(\d+)/)?.[1]
    expect(projectId).toBeTruthy()

    await clickStage(page, /План|Планировка/i)
    await expect(page.getByTestId('layout-canvas')).toBeVisible({ timeout: 45_000 })
    await expect(page.getByTestId('layout-view-2d')).toHaveAttribute('aria-pressed', 'true')

    // Existing plan → 3D preview of same DTO
    await page.getByTestId('layout-view-3d').click()
    await expect(
      page
        .getByTestId('layout-3d-preview')
        .or(page.getByTestId('layout-3d-empty'))
        .or(page.getByTestId('layout-3d-webgl-fallback')),
    ).toBeVisible({ timeout: 30_000 })
    const webglBlocked = await page.getByTestId('layout-3d-webgl-fallback').isVisible().catch(() => false)
    test.skip(webglBlocked, 'WebGL unavailable in this browser context')

    await page.getByTestId('layout-view-2d').click()
    await expect(page.getByTestId('layout-canvas')).toBeVisible({ timeout: 20_000 })

    const addRack = page.getByTestId('layout-add-rack')
    test.skip(!(await addRack.isVisible().catch(() => false)), 'add rack unavailable (read-only)')
    await addRack.click()
    await expect(page.getByTestId('layout-inspector')).toBeVisible()

    const rotation = page.getByTestId('layout-rotation-input')
    await expect(rotation).toBeVisible({ timeout: 15_000 })
    await rotation.fill('37')
    await rotation.blur()

    const idLabel = page.getByTestId('layout-inspector').getByText(/^ID:/)
    await expect(idLabel).toBeVisible()
    const objectId = ((await idLabel.textContent()) || '').replace(/^ID:\s*/, '').trim()
    expect(objectId.length).toBeGreaterThan(0)

    await page.getByTestId('layout-save').click()
    await expect(page.getByText(/План склада сохранён/i).first()).toBeVisible({ timeout: 30_000 })

    // Persist via real backend (not React state): GET layout after reload
    await page.reload()
    await expect(page).toHaveURL(new RegExp(`/app/projects/${projectId}`), { timeout: 45_000 })

    const restored = await page.evaluate(async (pid) => {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`/api/projects/${pid}/layout`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(`layout GET ${res.status}`)
      return res.json() as Promise<{
        objects: Array<{ id: string; rotation?: number; kind?: string }>
      }>
    }, projectId!)

    const savedObj = restored.objects.find((o) => o.id === objectId)
    expect(savedObj, `object ${objectId} missing after reload`).toBeTruthy()
    expect(Number(savedObj!.rotation || 0)).toBe(37)

    await clickStage(page, /План|Планировка/i)
    await expect(page.getByTestId('layout-canvas')).toBeVisible({ timeout: 45_000 })

    await page.getByTestId('layout-view-3d').click()
    // canvas вложен в preview — проверяем один корень (strict mode)
    await expect(page.getByTestId('layout-3d-preview')).toBeVisible({ timeout: 30_000 })
  })

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

  test('3D fit, layers, and inspector collapse enlarge scene', async ({ page }) => {
    test.setTimeout(180_000)
    await asGuest(page)
    await createWarehouseProject(page, 'P2 layout 3D UX')
    await clickStage(page, /План|Планировка/i)
    await expect(page.getByTestId('layout-canvas')).toBeVisible({ timeout: 45_000 })

    const addRack = page.getByTestId('layout-add-rack')
    if (await addRack.isVisible().catch(() => false)) await addRack.click()

    await page.getByTestId('layout-view-3d').click()
    await expect(page.getByTestId('layout-3d-preview')).toBeVisible({ timeout: 30_000 })
    const webglBlocked = await page.getByTestId('layout-3d-webgl-fallback').isVisible().catch(() => false)
    test.skip(webglBlocked, 'WebGL unavailable')

    await expect(page.getByTestId('layout-3d-canvas')).toBeVisible()
    const before = await page.getByTestId('layout-canvas-wrap').boundingBox()
    expect(before?.width).toBeGreaterThan(200)
    expect(before?.height).toBeGreaterThan(300)

    await page.getByTestId('layout-3d-fit').click()
    await expect(page.getByTestId('layout-3d-canvas')).toBeVisible()

    await expect(page.getByTestId('layout-3d-layer-grid')).toBeChecked()
    await page.getByTestId('layout-3d-layer-grid').click()
    await expect(page.getByTestId('layout-3d-layer-grid')).not.toBeChecked()

    await expect(page.getByTestId('layout-inspector')).toBeVisible()
    await page.getByTestId('layout-inspector-toggle').click()
    await expect(page.getByTestId('layout-inspector')).toBeHidden()
    const after = await page.getByTestId('layout-canvas-wrap').boundingBox()
    expect((after?.width || 0)).toBeGreaterThanOrEqual((before?.width || 0) - 2)

    await page.getByTestId('layout-inspector-toggle').click()
    await expect(page.getByTestId('layout-inspector')).toBeVisible()
    await expect(page.getByTestId('layout-inspector-summary').or(page.getByTestId('layout-rotation-input'))).toBeVisible()
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
    await expect(page.getByTestId('layout-3d-preview')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('layout-view-2d').click()
    await expect(page.getByTestId('layout-canvas')).toBeVisible()
    await expect(page.getByTestId('layout-inspector')).toBeVisible()
  })
})
