import { doublePrecision, integer, pgTable, text } from "drizzle-orm/pg-core";

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
