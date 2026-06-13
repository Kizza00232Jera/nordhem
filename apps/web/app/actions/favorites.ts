"use server";

import { revalidatePath } from "next/cache";
import { db } from "../../lib/db";
import { toggleFavorite } from "../../lib/favorites-repo";
import { getCurrentUser } from "../../lib/session";

export interface ToggleFavoriteResult {
  /** false when the user is not signed in — the UI should prompt sign-in. */
  ok: boolean;
  favorited?: boolean;
}

/**
 * Toggle a favorite. Favorites require login (D43): a signed-out request is
 * rejected (ok:false) rather than silently dropped, so the heart can roll back
 * its optimistic flip and send the visitor to /login.
 */
export async function toggleFavoriteAction(
  productId: number,
): Promise<ToggleFavoriteResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };

  const favorited = await toggleFavorite(db(), user.id, productId);
  revalidatePath("/favorites");
  return { ok: true, favorited };
}
