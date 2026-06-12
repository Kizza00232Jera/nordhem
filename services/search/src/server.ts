import type { Client } from "@elastic/elasticsearch";
import Fastify, { type FastifyInstance } from "fastify";
import { searchProducts } from "./search/search.ts";

export interface AppDeps {
  es: Client;
  index: string;
  logger?: boolean;
}

export function buildApp({ es, index, logger = false }: AppDeps): FastifyInstance {
  const app = Fastify({ logger });

  app.get("/health", async () => ({ status: "ok" }));

  app.get<{ Querystring: { q?: string } }>("/search", async (req, reply) => {
    const query = req.query.q?.trim();
    if (!query) {
      return reply.code(400).send({ error: "query parameter q is required" });
    }
    return searchProducts(es, index, query);
  });

  return app;
}
