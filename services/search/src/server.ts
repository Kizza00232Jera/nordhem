import type { Client } from "@elastic/elasticsearch";
import Fastify, { type FastifyInstance } from "fastify";
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

  app.get<{ Querystring: { q?: string; scope?: string } }>(
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
      return searchProducts(es, scope === "shop" ? shopIndex : index, query);
    },
  );

  return app;
}
