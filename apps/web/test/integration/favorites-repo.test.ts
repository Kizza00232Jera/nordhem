import {
  createDb,
  ensureSchema,
  productsRaw,
  shopProducts,
  user as userTable,
  type Db,
} from "@nordhem/db";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { isFavorite, listFavoriteIds, toggleFavorite } from "../../lib/favorites-repo";

// Favorites against real Postgres: a toggle must be idempotent (click twice =
// back to start) and strictly per-user (the composite pk enforces it). Login
// is required, so there is no guest path to test.
let container: StartedPostgreSqlContainer;
let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:17").start();
  ({ db, close } = createDb(container.getConnectionUri()));
  await ensureSchema(db);
  await db.insert(productsRaw).values([
    { productId: 1, name: "oak bed" },
    { productId: 2, name: "velvet sofa" },
  ]);
  await db.insert(shopProducts).values([
    { productId: 1, slug: "oak-bed-1", category: "beds", priceCents: 62999 },
    { productId: 2, slug: "velvet-sofa-2", category: "sofas", priceCents: 89999 },
  ]);
  await db.insert(userTable).values([
    { id: "user-a", name: "A", email: "a@nordhem.test", emailVerified: true },
    { id: "user-b", name: "B", email: "b@nordhem.test", emailVerified: true },
  ]);
}, 240_000);

afterAll(async () => {
  await close?.();
  await container?.stop();
});

beforeEach(async () => {
  await db.execute("DELETE FROM favorites");
});

describe("toggleFavorite", () => {
  it("adds a favorite when absent and reports it as favorited", async () => {
    expect(await toggleFavorite(db, "user-a", 1)).toBe(true);
    expect(await isFavorite(db, "user-a", 1)).toBe(true);
    expect(await listFavoriteIds(db, "user-a")).toEqual([1]);
  });

  it("removes the favorite on a second toggle (idempotent round-trip)", async () => {
    await toggleFavorite(db, "user-a", 1);
    expect(await toggleFavorite(db, "user-a", 1)).toBe(false);
    expect(await isFavorite(db, "user-a", 1)).toBe(false);
    expect(await listFavoriteIds(db, "user-a")).toEqual([]);
  });

  it("keeps favorites strictly per user", async () => {
    await toggleFavorite(db, "user-a", 1);
    await toggleFavorite(db, "user-b", 2);

    expect(await listFavoriteIds(db, "user-a")).toEqual([1]);
    expect(await listFavoriteIds(db, "user-b")).toEqual([2]);
    expect(await isFavorite(db, "user-b", 1)).toBe(false);
  });
});
