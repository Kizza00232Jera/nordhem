import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Two projects, same split as services/search and tools: fast unit/RTL tests
// (jsdom, run by `test`) versus real-Postgres integration tests (node env,
// Testcontainers, run by `test:integration`). Keeping them apart means a
// plain `pnpm test` never waits on a container pull.
export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        plugins: [react()],
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["test/**/*.test.{ts,tsx}"],
          exclude: ["test/integration/**"],
          setupFiles: ["test/setup.ts"],
        },
      },
      {
        test: {
          name: "integration",
          environment: "node",
          include: ["test/integration/**/*.test.ts"],
          testTimeout: 120_000,
          hookTimeout: 240_000,
        },
      },
    ],
  },
});
