import { defineConfig, devices } from "@playwright/test";

const PORT = 8790;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  projects: [
    { name: "setup", testMatch: /01-setup\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", testMatch: /02-participant\.spec\.ts/, dependencies: ["setup"], use: { ...devices["Pixel 7"] } },
    { name: "desktop", testMatch: /02-participant\.spec\.ts/, dependencies: ["mobile"], use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "admin", testMatch: /03-admin\.spec\.ts/, dependencies: ["desktop"], use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, acceptDownloads: true, storageState: "test-results/.auth-admin.json" } },
    { name: "visual", testMatch: /04-visual\.spec\.ts/, dependencies: ["admin"], use: { ...devices["Desktop Chrome"], storageState: "test-results/.auth-admin.json" } },
  ],
  webServer: {
    command: "npx vite build && node --import tsx e2e/server.ts",
    url: `http://localhost:${PORT}/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgresql://localhost:5432/ivent_avaliacao_e2e",
      ADMIN_EMAIL: "admin@e2e.local",
      ADMIN_PASSWORD: "E2eSenhaForte123",
      IP_HASH_SALT: "e2e-salt-0123456789",
      PUBLIC_BASE_URL: `http://localhost:${PORT}`,
      MIN_FILL_SECONDS: "1",
      LOG_SILENT: "true",
    },
  },
});
