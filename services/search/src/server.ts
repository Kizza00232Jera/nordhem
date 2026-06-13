import type { Client } from "@elastic/elasticsearch";
import Fastify, { type FastifyInstance } from "fastify";
import { autocompleteProducts } from "./search/autocomplete.ts";
import { searchProducts } from "./search/search.ts";
import type { SortOption } from "./search/query.ts";

const SORT_OPTIONS = ["relevance", "price_asc", "price_desc"] as const;

export interface AppDeps {
  es: Client;
  /** The full 43k corpus (relevance-lab / default scope). */
  index: string;
  /** The curated storefront index with card fields. */
  shopIndex: string;
  logger?: boolean;
}

export function buildApp({ es, index, shopIndex, logger = false }: AppDeps): FastifyInstance {
  const app = Fastify({ logger });

  app.get("/health", async () => ({ status: "ok" }));

  // A querystring value repeated (?category=a&category=b) arrives as an
  // array; a single one as a string. Normalize to a trimmed, non-empty list.
  const toList = (v: string | string[] | undefined): string[] =>
    (v === undefined ? [] : Array.isArray(v) ? v : [v])
      .map((s) => s.trim())
      .filter(Boolean);

  const toCents = (v: string | undefined): number | undefined => {
    if (v === undefined || v.trim() === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const toSort = (v: string | undefined): SortOption =>
    (SORT_OPTIONS as readonly string[]).includes(v ?? "")
      ? (v as SortOption)
      : "relevance";

  const toPage = (v: string | undefined): number => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 ? n : 1;
  };

  const toSize = (v: string | undefined): number | undefined => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 100 ? n : undefined;
  };

  app.get<{
    Querystring: {
      q?: string;
      scope?: string;
      category?: string | string[];
      color?: string | string[];
      material?: string | string[];
      priceMin?: string;
      priceMax?: string;
      sort?: string;
      page?: string;
      size?: string;
    };
  }>(
    "/search",
    async (req, reply) => {
      const query = req.query.q?.trim();
      if (!query) {
        return reply.code(400).send({ error: "query parameter q is required" });
      }
      const scope = req.query.scope ?? "all";
      if (scope !== "all" && scope !== "shop") {
        return reply.code(400).send({ error: 'scope must be "all" or "shop"' });
      }
      // Facets and filters are a shop-scope feature: only the curated index
      // has the `category` field, and the benchmark scope needs no filter UI
      // (D7).
      const isShop = scope === "shop";
      return searchProducts(es, isShop ? shopIndex : index, query, {
        facets: isShop,
        sort: toSort(req.query.sort),
        page: toPage(req.query.page),
        size: toSize(req.query.size),
        filters: isShop
          ? {
              category: toList(req.query.category),
              color: toList(req.query.color),
              material: toList(req.query.material),
              priceMin: toCents(req.query.priceMin),
              priceMax: toCents(req.query.priceMax),
            }
          : undefined,
      });
    },
  );

  app.get<{ Querystring: { q?: string; scope?: string } }>(
    "/autocomplete",
    async (req, reply) => {
      const query = req.query.q?.trim();
      if (!query) {
        return reply.code(400).send({ error: "query parameter q is required" });
      }
      const scope = req.query.scope ?? "shop";
      if (scope !== "all" && scope !== "shop") {
        return reply.code(400).send({ error: 'scope must be "all" or "shop"' });
      }
      return autocompleteProducts(es, scope === "shop" ? shopIndex : index, query);
    },
  );

  return app;
}
