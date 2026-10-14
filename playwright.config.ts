import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000", trace: "retain-on-failure" },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : { command: "pnpm dev", url: "http://localhost:3000/api/health", reuseExistingServer: true },
});
