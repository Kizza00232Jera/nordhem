import { and, desc, eq, favorites, type DbOrTx } from "@nordhem/db";

/**
 * Toggle a product in a user's favorites (the jysk.dk "Favoritter" model,
 * D43). Idempotent: a delete-then-insert-if-nothing-deleted does the flip in
 * one round-trip, so two quick clicks land on a consistent state. Returns the
 * resulting state — true if now favorited, false if removed.
 */
export async function toggleFavorite(
  db: DbOrTx,
  userId: string,
  productId: number,
): Promise<boolean> {
  const removed = await db
    .delete(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.productId, productId)))
    .returning({ productId: favorites.productId });
  if (removed.length > 0) return false;

  await db.insert(favorites).values({ userId, productId }).onConflictDoNothing();
  return true;
}

export async function isFavorite(
  db: DbOrTx,
  userId: string,
  productId: number,
): Promise<boolean> {
  const rows = await db
    .select({ productId: favorites.productId })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.productId, productId)));
  return rows.length > 0;
}

/** A user's favorited product ids, newest first. */
export async function listFavoriteIds(
  db: DbOrTx,
  userId: string,
): Promise<number[]> {
  const rows = await db
    .select({ productId: favorites.productId })
    .from(favorites)
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt));
  return rows.map((r) => r.productId);
}
