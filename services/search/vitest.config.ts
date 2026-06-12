import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["test/unit/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "integration",
          include: ["test/integration/**/*.test.ts"],
          // Container pulls + boots are slow; generous budgets, no retries
          // (a flaky test is a bug — docs/TESTING.md rule 6).
          testTimeout: 120_000,
          hookTimeout: 240_000,
        },
      },
    ],
  },
});
