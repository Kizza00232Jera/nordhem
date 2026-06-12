/**
 * Parser for the WANDS product.csv file — which, despite the extension, is
 * tab-separated with a header row. Fields never contain tabs or newlines,
 * so a plain split is correct (verified against the real 43k-row file).
 */
export interface RawProduct {
  productId: number;
  name: string;
  productClass: string | null;
  categoryHierarchy: string | null;
  description: string | null;
  features: string | null;
  ratingCount: number | null;
  averageRating: number | null;
  reviewCount: number | null;
}

const EXPECTED_HEADER = [
  "product_id",
  "product_name",
  "product_class",
  "category hierarchy",
  "product_description",
  "product_features",
  "rating_count",
  "average_rating",
  "review_count",
];

function optional(value: string | undefined): string | null {
  return value === undefined || value === "" ? null : value;
}

function optionalNumber(value: string | undefined): number | null {
  const text = optional(value);
  if (text === null) return null;
  const n = Number(text);
  if (Number.isNaN(n)) {
    throw new Error(`Expected a number, got "${text}"`);
  }
  return n;
}

export function parseProductsTsv(content: string): RawProduct[] {
  const lines = content.split("\n").map((l) => l.replace(/\r$/, ""));
  const header = lines[0]?.split("\t");
  if (!header || EXPECTED_HEADER.some((col, i) => header[i] !== col)) {
    throw new Error(
      `Unexpected WANDS header: ${JSON.stringify(header)} — the dataset format changed.`,
    );
  }

  return lines
    .slice(1)
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const cols = line.split("\t");
      const productId = optionalNumber(cols[0]);
      const name = optional(cols[1]);
      if (productId === null || name === null) {
        throw new Error(`Product row missing id or name: "${line.slice(0, 80)}"`);
      }
      return {
        productId,
        name,
        productClass: optional(cols[2]),
        categoryHierarchy: optional(cols[3]),
        description: optional(cols[4]),
        features: optional(cols[5]),
        ratingCount: optionalNumber(cols[6]),
        averageRating: optionalNumber(cols[7]),
        reviewCount: optionalNumber(cols[8]),
      };
    });
}
