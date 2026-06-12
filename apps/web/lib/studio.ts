"use server";

import {
  asc,
  eq,
  photoPool,
  productImages,
  productsRaw,
  shopProducts,
} from "@nordhem/db";
import { revalidatePath } from "next/cache";
import { db } from "./db";

export async function studioProducts(category: string) {
  return db()
    .select({
      productId: shopProducts.productId,
      slug: shopProducts.slug,
      name: productsRaw.name,
      thumbUrl: productImages.thumbUrl,
      status: productImages.status,
    })
    .from(shopProducts)
    .innerJoin(productsRaw, eq(shopProducts.productId, productsRaw.productId))
    .leftJoin(productImages, eq(shopProducts.productId, productImages.productId))
    .where(eq(shopProducts.category, category))
    .orderBy(asc(shopProducts.productId));
}

export async function studioProductDetail(productId: number) {
  const rows = await db()
    .select({
      productId: shopProducts.productId,
      name: productsRaw.name,
      category: shopProducts.category,
      url: productImages.url,
      thumbUrl: productImages.thumbUrl,
      photographerName: productImages.photographerName,
      searchQuery: productImages.searchQuery,
      status: productImages.status,
    })
    .from(shopProducts)
    .innerJoin(productsRaw, eq(shopProducts.productId, productsRaw.productId))
    .leftJoin(productImages, eq(shopProducts.productId, productImages.productId))
    .where(eq(shopProducts.productId, productId))
    .limit(1);
  return rows[0] ?? null;
}

export async function poolForQuery(searchQuery: string) {
  return db()
    .select()
    .from(photoPool)
    .where(eq(photoPool.searchQuery, searchQuery))
    .orderBy(asc(photoPool.id));
}

/** The studio's manual override — survives pipeline re-runs (status guard). */
export async function swapImage(formData: FormData) {
  const productId = Number(formData.get("productId"));
  const photoId = Number(formData.get("photoId"));
  if (!Number.isInteger(productId) || !Number.isInteger(photoId)) return;

  const photo = (
    await db().select().from(photoPool).where(eq(photoPool.id, photoId)).limit(1)
  )[0];
  if (!photo) return;

  await db()
    .update(productImages)
    .set({
      url: photo.url,
      thumbUrl: photo.thumbUrl,
      photographerName: photo.photographerName,
      photographerUrl: photo.photographerUrl,
      source: photo.source,
      status: "swapped",
    })
    .where(eq(productImages.productId, productId));

  revalidatePath(`/studio/images/${productId}`);
  revalidatePath("/studio/images");
}
