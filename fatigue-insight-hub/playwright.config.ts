import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90000,
  expect: { timeout: 15000 },
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:8081', reducedMotion: 'reduce', trace: 'retain-on-failure',
    launchOptions: process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {} },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: [
    { command: 'npm run dev -- --host 127.0.0.1 --port 8081', url: 'http://127.0.0.1:8081', reuseExistingServer: !process.env.CI,
      env: { VITE_API_URL: 'http://127.0.0.1:8013' } },
    { command: `${process.env.PYTHON_BIN || 'python'} -m uvicorn api.api_server:app --host 127.0.0.1 --port 8013`, cwd: '../fatigue-tool',
      url: 'http://127.0.0.1:8013/health', reuseExistingServer: !process.env.CI,
      env: { CORS_ORIGINS: 'http://127.0.0.1:8081', RATE_LIMIT_PER_MINUTE: '0' } },
  ],
});
