/**
 * The eight NORDHEM storefront categories — the cross-surface contract
 * between curation (tools), the storefront, and the studio. The WANDS
 * class mapping behind each category lives in tools/src/curate.
 */
export interface ShopCategory {
  slug: string;
  title: string;
  blurb: string;
}

export const SHOP_CATEGORIES: readonly ShopCategory[] = [
  { slug: "beds", title: "Beds", blurb: "Frames, headboards and daybeds for deep sleep." },
  { slug: "mattresses", title: "Mattresses", blurb: "Foam, spring and toppers, honestly firm." },
  { slug: "sofas", title: "Sofas", blurb: "Sectionals, futons and places to land." },
  { slug: "wardrobes", title: "Wardrobes & storage", blurb: "A place for everything you own." },
  { slug: "desks", title: "Desks & office", blurb: "Work happens at home too." },
  { slug: "lighting", title: "Lighting", blurb: "Lamps and fixtures for long winters." },
  { slug: "rugs", title: "Rugs", blurb: "Warm floors, quiet rooms." },
  { slug: "garden", title: "Garden", blurb: "Patio life for the bright months." },
];

export function shopCategory(slug: string): ShopCategory | undefined {
  return SHOP_CATEGORIES.find((c) => c.slug === slug);
}
