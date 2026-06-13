import {
  cart as cartTable,
  createDb,
  ensureSchema,
  eq,
  orderItems,
  orders,
  productImages,
  productsRaw,
  shopProducts,
  user as userTable,
  type Db,
} from "@nordhem/db";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addToCart, createCart, getCartLines } from "../../lib/cart-repo";
import { checkout, EmptyCartError } from "../../lib/checkout-repo";

// Checkout is the one place money and history are frozen, so it is a single
// db.transaction tested on a real Postgres: cart -> order + snapshotted lines
// -> cart cleared, all-or-nothing. We prove the snapshot does not track the
// live catalog and that a failure anywhere rolls the whole thing back.
let container: StartedPostgreSqlContainer;
let db: Db;
let close: () => Promise<void>;

const ADDRESS = {
  fullName: "Test Shopper",
  line1: "Storgata 1",
  line2: null,
  city: "Oslo",
  postalCode: "0155",
  country: "NO",
};

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:17").start();
  ({ db, close } = createDb(container.getConnectionUri()));
  await ensureSchema(db);
  await db.insert(productsRaw).values([
    { productId: 1, name: "Oak bed" },
    { productId: 3, name: "Wool rug" },
  ]);
  await db.insert(shopProducts).values([
    { productId: 1, slug: "oak-bed-1", category: "beds", priceCents: 62999 },
    { productId: 3, slug: "wool-rug-3", category: "rugs", priceCents: 12999 },
  ]);
  await db.insert(productImages).values({
    productId: 1,
    url: "https://img.test/oak-bed.jpg",
    thumbUrl: "https://img.test/oak-bed-t.jpg",
    photographerName: "A",
    photographerUrl: "https://x.test",
    source: "unsplash",
    searchQuery: "bed",
  });
  await db.insert(userTable).values({
    id: "user-1",
    name: "Test Shopper",
    email: "shopper@nordhem.test",
    emailVerified: true,
  });
}, 240_000);

afterAll(async () => {
  await close?.();
  await container?.stop();
});

beforeEach(async () => {
  await db.delete(orders);
  await db.delete(cartTable);
  // Reset prices in case a test mutated them.
  await db.update(shopProducts).set({ priceCents: 62999 }).where(eq(shopProducts.productId, 1));
  await db.update(shopProducts).set({ priceCents: 12999 }).where(eq(shopProducts.productId, 3));
});

async function seedCart(): Promise<string> {
  const { id } = await createCart(db, "user-1");
  await addToCart(db, id, 1, 1); // 62999
  await addToCart(db, id, 3, 2); // 25998
  return id;
}

describe("checkout", () => {
  it("turns the cart into an order with snapshotted lines and clears the cart", async () => {
    const cartId = await seedCart();
    const order = await checkout(db, { userId: "user-1", cartId, address: ADDRESS });

    expect(order.orderNumber).toMatch(/^NDH-\d{4}-\d{6}$/);
    expect(order.subtotalCents).toBe(62999 + 25998);
    expect(order.shippingCents).toBe(0); // over the free-shipping threshold
    expect(order.totalCents).toBe(62999 + 25998);

    const lines = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id))
      .orderBy(orderItems.productId);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      productId: 1,
      nameSnapshot: "Oak bed",
      slugSnapshot: "oak-bed-1",
      imageUrlSnapshot: "https://img.test/oak-bed.jpg",
      unitPriceCents: 62999,
      quantity: 1,
    });
    expect(lines[1]).toMatchObject({
      productId: 3,
      nameSnapshot: "Wool rug",
      imageUrlSnapshot: null,
      unitPriceCents: 12999,
      quantity: 2,
    });

    // Cart cleared.
    expect(await getCartLines(db, cartId)).toEqual([]);
  });

  it("rejects an empty cart and writes no order", async () => {
    const { id: cartId } = await createCart(db, "user-1");
    await expect(
      checkout(db, { userId: "user-1", cartId, address: ADDRESS }),
    ).rejects.toBeInstanceOf(EmptyCartError);
    expect(await db.select().from(orders)).toHaveLength(0);
  });

  it("freezes the price: a later catalog price change does not move the order", async () => {
    const cartId = await seedCart();
    const order = await checkout(db, { userId: "user-1", cartId, address: ADDRESS });

    await db.update(shopProducts).set({ priceCents: 99999 }).where(eq(shopProducts.productId, 1));

    const [line] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    expect(line.unitPriceCents).toBe(62999); // unchanged
  });

  it("rolls everything back when payment authorization fails", async () => {
    const cartId = await seedCart();
    await expect(
      checkout(
        db,
        { userId: "user-1", cartId, address: ADDRESS },
        {
          beforeCommit: async () => {
            throw new Error("payment declined");
          },
        },
      ),
    ).rejects.toThrow("payment declined");

    // No order, and the cart is untouched.
    expect(await db.select().from(orders)).toHaveLength(0);
    expect(await getCartLines(db, cartId)).toEqual([
      { productId: 1, quantity: 1 },
      { productId: 3, quantity: 2 },
    ]);
  });
});
