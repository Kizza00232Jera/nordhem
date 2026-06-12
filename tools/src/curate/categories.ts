/**
 * The NORDHEM storefront taxonomy (PLAN step 2): eight JYSK-like categories
 * mapped from WANDS product_class values. Class lists were chosen from the
 * real distribution in products_raw — every category has 250+ candidates.
 *
 * WANDS multi-class values are pipe-joined ("Futons|Sofas"); a product
 * belongs to the first category any of its class segments matches exactly.
 * Exact segment equality, never substring: "Kids Beds" must not match "Beds".
 */
export interface CategoryDef {
  slug: string;
  title: string;
  classes: readonly string[];
}

export const CATEGORIES: readonly CategoryDef[] = [
  {
    slug: "beds",
    title: "Beds",
    classes: ["Beds", "Bed Frames", "Headboards", "Daybeds & Guest Beds"],
  },
  {
    slug: "mattresses",
    title: "Mattresses",
    classes: [
      "Foam and Latex Mattresses",
      "Innerspring Mattresses",
      "Mattress Toppers and Pads",
    ],
  },
  {
    slug: "sofas",
    title: "Sofas",
    classes: ["Sofas", "Sectionals", "Futons", "Indoor Chaise Lounges"],
  },
  {
    slug: "wardrobes",
    title: "Wardrobes & storage",
    classes: [
      "Armoires & Wardrobes",
      "Dressers & Chests",
      "Closet Storage & Organization",
    ],
  },
  {
    slug: "desks",
    title: "Desks & office",
    classes: ["Desks", "Office Chairs"],
  },
  {
    slug: "lighting",
    title: "Lighting",
    classes: [
      "Table Lamps",
      "Floor Lamps",
      "Chandeliers",
      "Flush Mount Lighting",
      "Vanity Lighting",
    ],
  },
  {
    slug: "rugs",
    title: "Rugs",
    classes: ["Area Rugs"],
  },
  {
    slug: "garden",
    title: "Garden",
    classes: [
      "Patio Sofas",
      "Outdoor Conversation Sets",
      "Patio Dining Sets",
      "Patio Lounge Chairs",
      "Patio Chaise Lounges",
      "Garden Statues",
      "Planters",
    ],
  },
];

export function categorize(productClass: string | null): string | null {
  if (productClass === null) return null;
  const segments = productClass.split("|").map((s) => s.trim());
  for (const category of CATEGORIES) {
    if (segments.some((s) => category.classes.includes(s))) {
      return category.slug;
    }
  }
  return null;
}
