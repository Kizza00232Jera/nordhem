import { defineConfig } from "drizzle-kit";

// drizzle-kit reads schema.ts and emits SQL migrations into ./migrations.
// From step 5 on, user/order/cart tables make schema evolution routine, so we
// keep a real migration history here. ensure-schema.ts stays in sync as the
// fast idempotent bootstrap that every integration test and dev boot uses.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://nordhem:nordhem@localhost:5432/nordhem",
  },
});
