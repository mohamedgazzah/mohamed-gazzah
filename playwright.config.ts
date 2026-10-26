import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 3200)

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec/ },
  ],
  webServer: {
    // Resets the e2e database, seeds demo data, builds and starts the app.
    command: 'npx tsx --conditions=react-server scripts/e2e-server.ts',
    url: `http://localhost:${PORT}/`,
    timeout: 600_000,
    reuseExistingServer: !!process.env.E2E_REUSE,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
