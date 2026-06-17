/**
 * Step 11c: the chatbot's single tool, search over OUR catalog. Giving the model
 * one grounded tool (and no others) keeps it honest — it answers from real
 * products and cannot invent inventory — and keeps the LLM out of ranking: it
 * asks our search service for results and only summarises them.
 */

export interface SearchToolArgs {
  query: string;
  category?: string;
  color?: string;
  material?: string;
  /** Max price the shopper will pay, in EUROS (converted to cents for the API). */
  priceMax?: number;
  size?: number;
}

/** OpenAI-compatible function/tool definition sent to the model. */
export const searchProductsTool = {
  type: "function" as const,
  function: {
    name: "search_products",
    description:
      "Search the NORDHEM furniture catalog and return matching products. Use this for any question about what the shop sells; never invent products.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to search for, e.g. 'velvet sofa' or 'bedside table'." },
        category: { type: "string", description: "Optional category filter, e.g. 'sofas', 'beds'." },
        color: { type: "string", description: "Optional colour filter, e.g. 'green'." },
        material: { type: "string", description: "Optional material filter, e.g. 'oak', 'velvet'." },
        priceMax: { type: "number", description: "Optional maximum price in euros." },
        size: { type: "integer", description: "How many results to return (1-10, default 6)." },
      },
      required: ["query"],
    },
  },
};

/** Build the search-service querystring from the model's tool arguments. */
export function toolArgsToQueryString(args: SearchToolArgs): string {
  const n = typeof args.size === "number" && Number.isFinite(args.size) ? Math.round(args.size) : 6;
  const size = Math.max(1, Math.min(10, n));
  const p = new URLSearchParams();
  p.set("q", args.query);
  p.set("scope", "shop");
  p.set("size", String(size));
  if (args.category) p.set("category", args.category);
  if (args.color) p.set("color", args.color);
  if (args.material) p.set("material", args.material);
  if (typeof args.priceMax === "number" && Number.isFinite(args.priceMax)) {
    p.set("priceMax", String(Math.round(args.priceMax * 100)));
  }
  return p.toString();
}

export interface ToolHit {
  name: string;
  priceCents?: number | null;
  category?: string | null;
  slug?: string | null;
}

/** Compact, model-friendly rendering of the hits (kept short on purpose). */
export function formatHitsForModel(hits: ToolHit[]): string {
  if (hits.length === 0) return "No matching products found.";
  return hits
    .map((h, i) => {
      const price = h.priceCents != null ? `€${(h.priceCents / 100).toFixed(2)}` : "price n/a";
      const cat = h.category ? ` (${h.category})` : "";
      const slug = h.slug ? ` [/product/${h.slug}]` : "";
      return `${i + 1}. ${h.name} — ${price}${cat}${slug}`;
    })
    .join("\n");
}
