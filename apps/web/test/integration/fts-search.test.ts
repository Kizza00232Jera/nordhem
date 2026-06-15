import {
  createDb,
  ensureSchema,
  productImages,
  productsRaw,
  shopProducts,
  type Db,
} from "@nordhem/db";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ftsSearchShop } from "../../lib/fts-search";

// The lite-mode Postgres full-text fallback against a real Postgres. The
// to_tsvector / plainto_tsquery match and ranking are the thing under test, so
// they run on the real engine over a small seeded catalog.
let container: StartedPostgreSqlContainer;
let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:17").start();
  ({ db, close } = createDb(container.getConnectionUri()));
  await ensureSchema(db);
  await db.insert(productsRaw).values([
    { productId: 1, name: "Velvet Chesterfield Sofa", description: "a plush velvet sofa for the living room" },
    { productId: 2, name: "Wool Area Rug", description: "a soft hand-woven wool rug" },
    { productId: 3, name: "Oak Bed Frame", description: "a solid oak bed frame" },
  ]);
  await db.insert(shopProducts).values([
    { productId: 1, slug: "velvet-sofa-1", category: "sofas", priceCents: 89999 },
    { productId: 2, slug: "wool-rug-2", category: "rugs", priceCents: 12999 },
    { productId: 3, slug: "oak-bed-3", category: "beds", priceCents: 62999 },
  ]);
  await db.insert(productImages).values({
    productId: 1,
    url: "https://img/1.jpg",
    thumbUrl: "https://img/1-thumb.jpg",
    photographerName: "A",
    photographerUrl: "https://x",
    source: "unsplash",
    searchQuery: "sofa",
  });
}, 240_000);

afterAll(async () => {
  await close?.();
  await container?.stop();
});

describe("ftsSearchShop", () => {
  it("matches on the text and labels the response as a fallback", async () => {
    const res = await ftsSearchShop(db, "velvet sofa");
    expect(res.mode).toBe("fallback");
    expect(res.total).toBe(1);
    expect(res.hits[0]).toMatchObject({
      id: "1",
      slug: "velvet-sofa-1",
      category: "sofas",
      priceCents: 89999,
      imageThumbUrl: "https://img/1-thumb.jpg",
    });
  });

  it("stems so a singular query still finds it", async () => {
    const res = await ftsSearchShop(db, "rugs");
    expect(res.total).toBe(1);
    expect(res.hits[0]?.id).toBe("2");
  });

  it("returns nothing for an out-of-catalog query", async () => {
    const res = await ftsSearchShop(db, "trampoline");
    expect(res.total).toBe(0);
    expect(res.hits).toEqual([]);
  });

  it("paginates", async () => {
    // "frame" + "rug" + "sofa" all present; query a common word across all 3.
    const all = await ftsSearchShop(db, "a", { size: 24 }); // stopword -> no match
    expect(all.total).toBe(0);
    const page1 = await ftsSearchShop(db, "oak", { size: 1, page: 1 });
    expect(page1.hits).toHaveLength(1);
    expect(page1.total).toBe(1);
  });
});
