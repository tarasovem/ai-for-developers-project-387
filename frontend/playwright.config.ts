import { defineConfig } from '@playwright/test'

const backendBaseUrl = 'http://127.0.0.1:3000'
const frontendBaseUrl = 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: frontendBaseUrl,
    trace: 'retain-on-failure'
  },
  webServer: [
    {
      command: 'npm run build && HOST=127.0.0.1 PORT=3000 npm run start',
      cwd: '../backend',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    {
      command: `VITE_API_BASE_URL=${backendBaseUrl} npm run build && VITE_API_BASE_URL=${backendBaseUrl} npm run preview -- --host 127.0.0.1 --port 4173`,
      port: 4173,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  ]
})
