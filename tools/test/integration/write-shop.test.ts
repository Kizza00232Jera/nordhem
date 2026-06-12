import { createDb, ensureSchema, productsRaw, shopProducts, type Db } from "@nordhem/db";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { writeShopProducts } from "../../src/curate/write.ts";

let container: StartedPostgreSqlContainer;
let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:17").start();
  ({ db, close } = createDb(container.getConnectionUri()));
  await ensureSchema(db);
  // shop_products has a FK to products_raw — seed the parents.
  await db.insert(productsRaw).values([
    { productId: 1, name: "oak bed" },
    { productId: 2, name: "velvet sofa" },
  ]);
});

afterAll(async () => {
  await close?.();
  await container?.stop();
});

describe("writeShopProducts", () => {
  it("inserts the curated catalog and roundtrips it", async () => {
    const count = await writeShopProducts(db, [
      { productId: 1, slug: "oak-bed-1", category: "beds", priceCents: 62999 },
      { productId: 2, slug: "velvet-sofa-2", category: "sofas", priceCents: 89999 },
    ]);
    expect(count).toBe(2);

    const rows = await db.select().from(shopProducts).orderBy(shopProducts.productId);
    expect(rows).toEqual([
      { productId: 1, slug: "oak-bed-1", category: "beds", priceCents: 62999 },
      { productId: 2, slug: "velvet-sofa-2", category: "sofas", priceCents: 89999 },
    ]);
  });

  it("replaces wholesale on re-run instead of duplicating", async () => {
    await writeShopProducts(db, [
      { productId: 1, slug: "oak-bed-1", category: "beds", priceCents: 62999 },
    ]);
    const rows = await db.select().from(shopProducts);
    expect(rows).toHaveLength(1);
  });
});
