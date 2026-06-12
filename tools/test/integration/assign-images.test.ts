import {
  createDb,
  ensureSchema,
  eq,
  photoPool,
  productImages,
  productsRaw,
  shopProducts,
  type Db,
} from "@nordhem/db";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { writeAssignments } from "../../src/curate/images-write.ts";

let container: StartedPostgreSqlContainer;
let db: Db;
let close: () => Promise<void>;

function poolPhoto(id: number) {
  return {
    searchQuery: "cozy bedroom bed",
    url: `https://images.example/photo-${id}`,
    thumbUrl: `https://images.example/photo-${id}-thumb`,
    photographerName: `Photographer ${id}`,
    photographerUrl: `https://unsplash.com/@p${id}`,
    source: "unsplash",
  };
}

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:17").start();
  ({ db, close } = createDb(container.getConnectionUri()));
  await ensureSchema(db);
  await db.insert(productsRaw).values([
    { productId: 1, name: "oak bed" },
    { productId: 2, name: "pine bed" },
  ]);
  await db.insert(shopProducts).values([
    { productId: 1, slug: "oak-bed-1", category: "beds", priceCents: 62999 },
    { productId: 2, slug: "pine-bed-2", category: "beds", priceCents: 18999 },
  ]);
});

afterAll(async () => {
  await close?.();
  await container?.stop();
});

describe("writeAssignments", () => {
  it("assigns pool photos to products with full credit fields", async () => {
    const [p1, p2] = await db.insert(photoPool).values([poolPhoto(1), poolPhoto(2)]).returning();

    const written = await writeAssignments(db, [
      { productId: 1, photoId: p1!.id },
      { productId: 2, photoId: p2!.id },
    ]);
    expect(written).toBe(2);

    const rows = await db.select().from(productImages).orderBy(productImages.productId);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      productId: 1,
      url: "https://images.example/photo-1",
      photographerName: "Photographer 1",
      source: "unsplash",
      searchQuery: "cozy bedroom bed",
      status: "auto",
    });
  });

  it("re-running overwrites auto assignments but never a manual swap", async () => {
    // Antonio swapped product 2's photo in the studio:
    await db
      .update(productImages)
      .set({ url: "https://images.example/hand-picked", status: "swapped" })
      .where(eq(productImages.productId, 2));

    const pool = await db.select().from(photoPool);
    await writeAssignments(db, [
      { productId: 1, photoId: pool[1]!.id }, // auto row: may change
      { productId: 2, photoId: pool[0]!.id }, // swapped row: must not change
    ]);

    const rows = await db.select().from(productImages).orderBy(productImages.productId);
    expect(rows[0]?.url).toBe("https://images.example/photo-2");
    expect(rows[1]?.url).toBe("https://images.example/hand-picked");
    expect(rows[1]?.status).toBe("swapped");
  });
});
