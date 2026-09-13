import { defineConfig } from '@playwright/test'
import * as v from 'valibot'

const port = v.parse(
  v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65535)),
  Number(process.env.PLAYWRIGHT_PORT ?? 1420)
)

export default defineConfig({
  testDir: './tests',
  timeout: 15_000,
  workers: 1,
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      threshold: 0.3
    },
    toMatchSnapshot: {
      maxDiffPixelRatio: 0.01,
      threshold: 0.3
    }
  },
  use: {
    baseURL: `http://localhost:${port}`,
    testIdAttribute: 'data-test-id',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    launchOptions: {
      args: ['--enable-unsafe-swiftshader']
    }
  },
  projects: [
    {
      name: 'openpencil',
      testDir: './tests/e2e',
      testIgnore: '**/native/**',
      fullyParallel: false
    },
    {
      name: 'openpencil-webkit',
      testDir: './tests/e2e',
      testMatch: [
        '**/*.webkit.spec.ts',
        '**/design/panel.spec.ts',
        '**/export/basic.spec.ts',
        '**/fonts/settings.spec.ts'
      ],
      use: {
        browserName: 'webkit'
      }
    },
    {
      name: 'figma',
      testDir: './tests/figma'
    }
  ],
  webServer: {
    command: `bun run dev --port ${port}`,
    port,
    reuseExistingServer: true
  }
})
