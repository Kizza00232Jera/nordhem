import {
  cart as cartTable,
  createDb,
  ensureSchema,
  eq,
  productsRaw,
  shopProducts,
  user as userTable,
  type Db,
} from "@nordhem/db";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MAX_QUANTITY } from "../../lib/cart-merge";
import {
  addToCart,
  createCart,
  getCartLines,
  getOrCreateUserCart,
  mergeGuestCartIntoUser,
} from "../../lib/cart-repo";

// The cart repo against a real Postgres: upsert semantics (one line per
// product, quantity accumulates and caps) and merge-on-login (guest cart
// folds into the user cart, guest row gone) are database behaviours, so they
// are tested on the real engine, never mocked. The money math and the pure
// merge rule have their own unit tests; this proves they land in PG correctly.
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
    { productId: 3, name: "wool rug" },
  ]);
  await db.insert(shopProducts).values([
    { productId: 1, slug: "oak-bed-1", category: "beds", priceCents: 62999 },
    { productId: 2, slug: "velvet-sofa-2", category: "sofas", priceCents: 89999 },
    { productId: 3, slug: "wool-rug-3", category: "rugs", priceCents: 12999 },
  ]);
  await db.insert(userTable).values({
    id: "user-1",
    name: "Cart Owner",
    email: "owner@nordhem.test",
    emailVerified: true,
  });
}, 240_000);

afterAll(async () => {
  await close?.();
  await container?.stop();
});

// Each test starts from a clean cart set so they don't leak state into one
// another (carts cascade to their items).
beforeEach(async () => {
  await db.delete(cartTable);
});

describe("addToCart", () => {
  it("creates a line with the requested quantity", async () => {
    const { id } = await createCart(db, null);
    await addToCart(db, id, 1, 2);
    expect(await getCartLines(db, id)).toEqual([{ productId: 1, quantity: 2 }]);
  });

  it("bumps the quantity when the same product is added again", async () => {
    const { id } = await createCart(db, null);
    await addToCart(db, id, 1, 2);
    await addToCart(db, id, 1, 3);
    expect(await getCartLines(db, id)).toEqual([{ productId: 1, quantity: 5 }]);
  });

  it("caps an accumulated quantity at the maximum", async () => {
    const { id } = await createCart(db, null);
    await addToCart(db, id, 1, 90);
    await addToCart(db, id, 1, 20);
    expect(await getCartLines(db, id)).toEqual([
      { productId: 1, quantity: MAX_QUANTITY },
    ]);
  });
});

describe("mergeGuestCartIntoUser", () => {
  it("folds the guest cart into the user cart and deletes the guest row", async () => {
    const userCart = await getOrCreateUserCart(db, "user-1");
    await addToCart(db, userCart.id, 1, 1); // product 1 in user cart
    await addToCart(db, userCart.id, 2, 1); // product 2 in user cart

    const { id: guestCartId } = await createCart(db, null);
    await addToCart(db, guestCartId, 2, 1); // overlap -> sums to 2
    await addToCart(db, guestCartId, 3, 4); // guest-only -> appended

    await mergeGuestCartIntoUser(db, guestCartId, "user-1");

    expect(await getCartLines(db, userCart.id)).toEqual([
      { productId: 1, quantity: 1 },
      { productId: 2, quantity: 2 },
      { productId: 3, quantity: 4 },
    ]);
    // Guest cart row is gone (its items cascade away with it).
    const guestRows = await db.select().from(cartTable).where(eq(cartTable.id, guestCartId));
    expect(guestRows).toHaveLength(0);
  });

  it("creates the user cart when the user had none yet", async () => {
    const { id: guestCartId } = await createCart(db, null);
    await addToCart(db, guestCartId, 3, 2);

    const merged = await mergeGuestCartIntoUser(db, guestCartId, "user-1");
    expect(await getCartLines(db, merged.id)).toEqual([{ productId: 3, quantity: 2 }]);
  });
});
