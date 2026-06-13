import type { Client } from "@elastic/elasticsearch";
import Fastify, { type FastifyInstance } from "fastify";
import { autocompleteProducts } from "./search/autocomplete.ts";
import { searchProducts } from "./search/search.ts";

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

  app.get<{
    Querystring: {
      q?: string;
      scope?: string;
      category?: string | string[];
      color?: string | string[];
      material?: string | string[];
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
        filters: isShop
          ? {
              category: toList(req.query.category),
              color: toList(req.query.color),
              material: toList(req.query.material),
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
