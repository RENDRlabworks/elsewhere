import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3210);
const dataDir = process.env.E2E_DATA_DIR ?? path.join(os.tmpdir(), `elsewhere-e2e-${Date.now()}`);

/**
 * End-to-end tests run against a dev server in local development mode with an
 * isolated data directory and the development sketch provider (no API keys).
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    viewport: { width: 1600, height: 1000 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1600, height: 1000 } } }],
  webServer: {
    command: `pnpm next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/api/bootstrap`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      ELSEWHERE_DATA_MODE: "local",
      ELSEWHERE_DATA_DIR: dataDir,
      ELSEWHERE_DEV_PROVIDER: "1",
      OPENAI_API_KEY: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
    },
  },
});
