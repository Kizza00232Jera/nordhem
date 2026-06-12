import { CATEGORIES } from "./categories.ts";

/**
 * Photo planning for the image pipeline (D8). One Unsplash search per
 * canonical taxonomy class — not per product — keeps the whole 800-product
 * run inside the demo-tier rate limit (~45 requests instead of 800).
 * Photos are then round-robined across the class's products: a photo
 * represents the product TYPE, never the literal SKU, and the storefront
 * credits the photographer.
 */
export function canonicalClass(productClass: string, category: string): string {
  const def = CATEGORIES.find((c) => c.slug === category);
  if (!def) throw new Error(`Unknown category "${category}"`);
  const segments = productClass.split("|").map((s) => s.trim());
  const match = segments.find((s) => def.classes.includes(s));
  if (!match) {
    throw new Error(`"${productClass}" has no segment in category "${category}"`);
  }
  return match;
}

const PHRASES: Record<string, string> = {
  "Beds": "cozy bedroom bed",
  "Bed Frames": "wooden bed frame",
  "Headboards": "bed headboard",
  "Daybeds & Guest Beds": "daybed",
  "Foam and Latex Mattresses": "mattress",
  "Innerspring Mattresses": "mattress bedroom",
  "Mattress Toppers and Pads": "mattress topper bedding",
  "Sofas": "sofa living room",
  "Sectionals": "sectional sofa",
  "Futons": "futon sofa",
  "Indoor Chaise Lounges": "chaise lounge indoor",
  "Armoires & Wardrobes": "wardrobe armoire",
  "Dressers & Chests": "dresser drawers bedroom",
  "Closet Storage & Organization": "closet organization",
  "Desks": "desk home office",
  "Office Chairs": "office chair",
  "Table Lamps": "table lamp",
  "Floor Lamps": "floor lamp interior",
  "Chandeliers": "chandelier",
  "Flush Mount Lighting": "ceiling light",
  "Vanity Lighting": "bathroom vanity light",
  "Area Rugs": "area rug living room",
  "Patio Sofas": "patio sofa outdoor",
  "Outdoor Conversation Sets": "outdoor patio furniture set",
  "Patio Dining Sets": "outdoor dining set patio",
  "Patio Lounge Chairs": "patio lounge chair",
  "Patio Chaise Lounges": "outdoor chaise lounge",
  "Garden Statues": "garden statue",
  "Planters": "plant pot planter",
};

export function photoPhrase(canonical: string): string {
  return PHRASES[canonical] ?? canonical.toLowerCase();
}

export interface ProductPhrase {
  productId: number;
  phrase: string;
}

export interface PoolPhoto {
  id: number;
  phrase: string;
}

export interface Assignment {
  productId: number;
  photoId: number;
}

export function planAssignments(
  products: ProductPhrase[],
  pool: PoolPhoto[],
): Assignment[] {
  const photosByPhrase = new Map<string, number[]>();
  for (const photo of pool) {
    let ids = photosByPhrase.get(photo.phrase);
    if (!ids) photosByPhrase.set(photo.phrase, (ids = []));
    ids.push(photo.id);
  }

  const counters = new Map<string, number>();
  return [...products]
    .sort((a, b) => a.productId - b.productId)
    .flatMap((p) => {
      const photos = photosByPhrase.get(p.phrase);
      if (!photos || photos.length === 0) return [];
      const i = counters.get(p.phrase) ?? 0;
      counters.set(p.phrase, i + 1);
      const photoId = photos[i % photos.length];
      return photoId === undefined ? [] : [{ productId: p.productId, photoId }];
    });
}
