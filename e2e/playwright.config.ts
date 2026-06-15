import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e-report', open: 'never' }]
  ],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 }
      },
      testIgnore: ['**/*.mobile.spec.ts']
    },
    {
      name: 'chromium-mobile-360',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 360, height: 740 }
      },
      testMatch: ['**/*.mobile.spec.ts']
    }
  ]
});
