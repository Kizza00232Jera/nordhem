import { db } from "./db";
import { listFavoriteIds } from "./favorites-repo";
import { getCurrentUser } from "./session";

/**
 * The set of product ids the current user has favorited, for seeding the heart
 * state on listing pages. Empty for guests — the heart still works on click,
 * it just starts unfilled.
 */
export async function currentUserFavoriteSet(): Promise<Set<number>> {
  const user = await getCurrentUser();
  if (!user) return new Set();
  return new Set(await listFavoriteIds(db(), user.id));
}
