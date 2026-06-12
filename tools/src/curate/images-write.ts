import { inArray, photoPool, productImages, sql, type Db } from "@nordhem/db";
import type { Assignment } from "./images-plan.ts";

/**
 * Upserts photo assignments. Rows whose status is 'swapped' were hand-picked
 * in the studio and are never overwritten by a pipeline re-run — that's the
 * setWhere guard on the conflict update.
 */
export async function writeAssignments(
  db: Db,
  assignments: Assignment[],
): Promise<number> {
  if (assignments.length === 0) return 0;

  const photos = await db
    .select()
    .from(photoPool)
    .where(inArray(photoPool.id, assignments.map((a) => a.photoId)));
  const byId = new Map(photos.map((p) => [p.id, p]));

  const rows = assignments.flatMap((a) => {
    const photo = byId.get(a.photoId);
    if (!photo) return [];
    return [{
      productId: a.productId,
      url: photo.url,
      thumbUrl: photo.thumbUrl,
      photographerName: photo.photographerName,
      photographerUrl: photo.photographerUrl,
      source: photo.source,
      searchQuery: photo.searchQuery,
      status: "auto",
    }];
  });

  await db
    .insert(productImages)
    .values(rows)
    .onConflictDoUpdate({
      target: productImages.productId,
      set: {
        url: sql`excluded.url`,
        thumbUrl: sql`excluded.thumb_url`,
        photographerName: sql`excluded.photographer_name`,
        photographerUrl: sql`excluded.photographer_url`,
        source: sql`excluded.source`,
        searchQuery: sql`excluded.search_query`,
        status: sql`excluded.status`,
      },
      setWhere: sql`${productImages.status} = 'auto'`,
    });
  return rows.length;
}
