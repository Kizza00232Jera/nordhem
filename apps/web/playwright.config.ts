import { defineConfig, devices } from "@playwright/test";

// Dedicated ports so the e2e never collides with a dev server (the NORDHEM app
// on 3000, or another project on 3001) — Playwright starts its own search
// service (3100) and Next app (3200), pointing Next at that search service.
const SEARCH_PORT = 3100;
const WEB_PORT = 3200;

/**
 * E2e for the Step 5 golden flow. Drives the real stack: a fresh Next app and
 * Fastify search service on isolated ports, against the live dev Postgres +
 * Elasticsearch. Serial, single worker — the tests place real orders in the
 * shared dev DB.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    // 127.0.0.1, not localhost: the Fastify search service binds IPv4 only,
    // and Playwright would otherwise resolve localhost to IPv6 (::1) and hang.
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Plain `tsx` (not `tsx watch`): the watcher never settles when spawned
      // without a TTY, so the server never reached listen() under Playwright.
      command: "pnpm --filter @nordhem/search exec tsx src/index.ts",
      env: { PORT: String(SEARCH_PORT) },
      url: `http://127.0.0.1:${SEARCH_PORT}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      // Production build, not `next dev`: dev-mode HMR misbehaves on a custom
      // port (the HMR websocket handshake fails and the client never
      // hydrates). next start has no HMR, hydrates normally, and matches CI.
      command: "pnpm build && pnpm start",
      env: {
        PORT: String(WEB_PORT),
        SEARCH_API_URL: `http://127.0.0.1:${SEARCH_PORT}`,
      },
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
