import {
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
} from "drizzle-orm/pg-core";

/**
 * Raw WANDS products, loaded 1:1 from product.csv. Postgres is the system
 * of record (D10); Elasticsearch indexes are always rebuildable from here.
 * Numeric stats stay double precision to mirror the float-formatted source.
 */
export const productsRaw = pgTable("products_raw", {
  productId: integer("product_id").primaryKey(),
  name: text("name").notNull(),
  productClass: text("product_class"),
  categoryHierarchy: text("category_hierarchy"),
  description: text("description"),
  features: text("features"),
  ratingCount: doublePrecision("rating_count"),
  averageRating: doublePrecision("average_rating"),
  reviewCount: doublePrecision("review_count"),
});

/**
 * The curated ~800-product storefront catalog (D7): a selected subset of
 * products_raw mapped onto NORDHEM's own categories, with deterministic
 * synthetic prices (WANDS ships no prices — see DECISIONS). Rebuilt by
 * tools' curate-shop; re-curation cascades image assignments away.
 */
export const shopProducts = pgTable("shop_products", {
  productId: integer("product_id")
    .primaryKey()
    .references(() => productsRaw.productId),
  slug: text("slug").notNull().unique(),
  category: text("category").notNull(),
  priceCents: integer("price_cents").notNull(),
});

/** One assigned photo per shop product, hotlinked with credit (D8). */
export const productImages = pgTable("product_images", {
  productId: integer("product_id")
    .primaryKey()
    .references(() => shopProducts.productId, { onDelete: "cascade" }),
  url: text("url").notNull(),
  thumbUrl: text("thumb_url").notNull(),
  photographerName: text("photographer_name").notNull(),
  photographerUrl: text("photographer_url").notNull(),
  source: text("source").notNull(),
  searchQuery: text("search_query").notNull(),
  status: text("status").notNull().default("auto"),
});

/** All candidate photos fetched per search query — the studio swap pool. */
export const photoPool = pgTable("photo_pool", {
  id: serial("id").primaryKey(),
  searchQuery: text("search_query").notNull(),
  url: text("url").notNull(),
  thumbUrl: text("thumb_url").notNull(),
  photographerName: text("photographer_name").notNull(),
  photographerUrl: text("photographer_url").notNull(),
  source: text("source").notNull(),
});
