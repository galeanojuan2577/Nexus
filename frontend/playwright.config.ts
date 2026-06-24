import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: "python3 -m uvicorn nexus.main:app --host 127.0.0.1 --port 8000",
      cwd: "../backend",
      port: 8000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npx vite --host 127.0.0.1 --port 5173",
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
