import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "../../src/db/client.ts";
import { ensureSchema } from "../../src/db/ensure-schema.ts";
import { productsRaw } from "../../src/db/schema.ts";
import { loadProducts } from "../../src/wands/load.ts";
import { parseProductsTsv } from "../../src/wands/parse.ts";

const FIXTURE_TSV = [
  "product_id\tproduct_name\tproduct_class\tcategory hierarchy\tproduct_description\tproduct_features\trating_count\taverage_rating\treview_count",
  "0\tsolid wood platform bed\tBeds\tFurniture / Bedroom Furniture / Beds\ta nice , quality bed frame\tcolor : caramel\t15.0\t4.5\t15.0",
  "42\tmesh task chair\tOffice Chairs\t\t\t\t\t\t",
  "7\tvelvet accent chair\tAccent Chairs\tFurniture / Living Room\tplush velvet chair\tcolor : emerald\t3.0\t5.0\t3.0",
].join("\n");

let container: StartedPostgreSqlContainer;
let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:17").start();
  ({ db, close } = createDb(container.getConnectionUri()));
  await ensureSchema(db);
});

afterAll(async () => {
  await close?.();
  await container?.stop();
});

describe("loadProducts into Postgres", () => {
  it("inserts parsed WANDS rows and roundtrips every field", async () => {
    const count = await loadProducts(db, parseProductsTsv(FIXTURE_TSV));
    expect(count).toBe(3);

    const rows = await db
      .select()
      .from(productsRaw)
      .orderBy(productsRaw.productId);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      productId: 0,
      name: "solid wood platform bed",
      productClass: "Beds",
      categoryHierarchy: "Furniture / Bedroom Furniture / Beds",
      description: "a nice , quality bed frame",
      features: "color : caramel",
      ratingCount: 15,
      averageRating: 4.5,
      reviewCount: 15,
    });
    // Optional fields survive as NULLs, not empty strings or zeros.
    expect(rows[2]).toMatchObject({
      productId: 42,
      categoryHierarchy: null,
      description: null,
      features: null,
      ratingCount: null,
      averageRating: null,
      reviewCount: null,
    });
  });

  it("is idempotent: reloading replaces instead of duplicating", async () => {
    await loadProducts(db, parseProductsTsv(FIXTURE_TSV));
    const rows = await db.select().from(productsRaw);
    expect(rows).toHaveLength(3);
  });
});
