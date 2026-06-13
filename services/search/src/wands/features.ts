/**
 * WANDS `product_features` is a pipe-delimited list of `key : value` pairs
 * (text values use spaces around the colon, numeric values none, and there
 * is an occasional empty-key noise segment). We derive two facetable
 * attributes from it — colour and material — choosing the best-covered key
 * per attribute (the WANDS feasibility scan: `color` 31%, rugs use
 * `primarycolor`; `primarymaterial`/`material` lead for material).
 *
 * Values are lowercased and trimmed so they collapse cleanly into facet
 * buckets. A product with no matching key simply has no value for that
 * facet (null) — it is then absent from that facet, which is correct given
 * the partial coverage of the dataset.
 */
function parseFeatures(features: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!features) return map;
  for (const segment of features.split("|")) {
    const colon = segment.indexOf(":");
    if (colon === -1) continue;
    const key = segment.slice(0, colon).trim().toLowerCase();
    const value = segment.slice(colon + 1).trim().toLowerCase();
    if (key === "" || value === "") continue;
    // First occurrence of a key wins (some keys repeat).
    if (!map.has(key)) map.set(key, value);
  }
  return map;
}

/** Return the first present key from a priority list. */
function firstOf(map: Map<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const value = map.get(key);
    if (value) return value;
  }
  return null;
}

const COLOR_KEYS = ["color", "primarycolor"];
const MATERIAL_KEYS = ["primarymaterial", "material", "framematerial", "upholsterymaterial"];

export function extractColor(features: string | null): string | null {
  return firstOf(parseFeatures(features), COLOR_KEYS);
}

export function extractMaterial(features: string | null): string | null {
  return firstOf(parseFeatures(features), MATERIAL_KEYS);
}
