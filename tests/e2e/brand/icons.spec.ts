import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

for (const deviceScaleFactor of [1, 2]) {
  test.describe(`brand at ${deviceScaleFactor}x`, () => {
    test.use({ deviceScaleFactor })
    test('the editor uses the optical brand mark and follows the selected app theme', async ({
      page
    }) => {
      await page.goto('/?test')
      await new CanvasHelper(page).waitForInit()
      const logo = page.getByTestId('app-logo')
      await expect(logo).toHaveAttribute('alt', 'OpenPencil')
      for (const appearance of ['light', 'dark'] as const) {
        await page.evaluate(async (appearance) => {
          const path = '/src/app/shell/theme.ts'
          const module = await import(path)
          module.useAppTheme().setTheme(appearance)
        }, appearance)
        await expect(logo).toHaveAttribute(
          'src',
          `/brand/mark-micro${appearance === 'dark' ? '-dark' : ''}.svg`
        )
        await expect(logo).toHaveJSProperty('naturalWidth', 16)
        await expect(logo).toHaveScreenshot(`brand-micro-${appearance}-${deviceScaleFactor}x.png`, {
          maxDiffPixels: 0,
          threshold: 0.1
        })
      }
    })
  })
}

test('the main SVG retains its approved appearance', async ({ page }) => {
  await page.goto('/brand/mark.svg')
  await expect(page.locator('svg')).toHaveScreenshot('brand-mark.png')
})

test('the larger dark SVG retains its palette and subtle grid', async ({ page }) => {
  await page.goto('/brand/mark-dark.svg')
  const mark = page.locator('svg')
  await mark.evaluate((svg) => {
    svg.style.backgroundColor = '#282828'
  })
  await expect(mark).toHaveScreenshot('brand-mark-dark.png')
})

test('browser icon declarations resolve without a duplicate manifest', async ({
  page,
  request
}) => {
  await page.goto('/?test')
  const icons = page.locator('link[rel="icon"], link[rel="apple-touch-icon"]')
  const paths = await icons.evaluateAll((links) => links.map((link) => link.getAttribute('href')))
  expect(paths).toEqual(
    expect.arrayContaining(['/favicon.ico', '/brand/favicon.svg', '/apple-touch-icon.png'])
  )
  for (const path of paths) {
    expect(path).toBeTruthy()
    if (!path) continue
    const response = await request.get(path)
    expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).not.toContain('text/html')
  }
  // The dev server deliberately disables PWA registration; production injects one manifest.
  expect(await page.locator('link[rel="manifest"]').count()).toBeLessThanOrEqual(1)
})
