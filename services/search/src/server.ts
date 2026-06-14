import type { Client } from "@elastic/elasticsearch";
import type { Db } from "@nordhem/db";
import Fastify, { type FastifyInstance } from "fastify";
import { makeEvalDataCache } from "./eval/eval-data.ts";
import { runEval, trainTestSplit } from "./eval/harness.ts";
import { loadCuration } from "./es/curations-db.ts";
import { reloadSynonyms } from "./es/indexer.ts";
import { loadSynonymRulesFromDb } from "./es/synonyms-db.ts";
import { autocompleteProducts } from "./search/autocomplete.ts";
import { searchProducts, type SearchMode } from "./search/search.ts";
import { buildSearchBody, coerceRankingConfig, priceBandBounds, type SortOption } from "./search/query.ts";

const SORT_OPTIONS = ["relevance", "price_asc", "price_desc"] as const;
const SEARCH_MODES = ["lexical", "semantic", "hybrid"] as const;

export interface AppDeps {
  es: Client;
  /** The full 43k corpus (relevance-lab / default scope). */
  index: string;
  /** The curated storefront index with card fields. */
  shopIndex: string;
  /** Postgres, only needed for the relevance-lab /eval endpoint. */
  db?: Db;
  logger?: boolean;
}

export function buildApp({ es, index, shopIndex, db, logger = false }: AppDeps): FastifyInstance {
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

  const toMode = (v: string | undefined): SearchMode =>
    (SEARCH_MODES as readonly string[]).includes(v ?? "")
      ? (v as SearchMode)
      : "lexical";

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
      price?: string;
      sort?: string;
      page?: string;
      size?: string;
      mode?: string;
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
      // A selected price band (?price=500-1000) maps to cents bounds; raw
      // priceMin/priceMax remain available for direct API callers.
      const band = priceBandBounds(req.query.price);
      // Curations are a shop-scope editor feature; read per query (Step 9).
      const curation = isShop && db ? await loadCuration(db, query) : undefined;
      return searchProducts(es, isShop ? shopIndex : index, query, {
        facets: isShop,
        mode: toMode(req.query.mode),
        ...(curation && { curation }),
        sort: toSort(req.query.sort),
        page: toPage(req.query.page),
        size: toSize(req.query.size),
        filters: isShop
          ? {
              category: toList(req.query.category),
              color: toList(req.query.color),
              material: toList(req.query.material),
              priceMin: band.priceMin ?? toCents(req.query.priceMin),
              priceMax: band.priceMax ?? toCents(req.query.priceMax),
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

  // _explain visualizer: why did this product score what it scored for this
  // query? Returns Elasticsearch's score-breakdown tree for one (query, doc)
  // pair, computed with the production ranking, so the studio can read it.
  app.get<{ Querystring: { q?: string; id?: string; scope?: string } }>(
    "/explain",
    async (req, reply) => {
      const query = req.query.q?.trim();
      const id = req.query.id?.trim();
      if (!query || !id) {
        return reply.code(400).send({ error: "q and id are required" });
      }
      const target = req.query.scope === "shop" ? shopIndex : index;
      const body = buildSearchBody(query, 1, {});
      try {
        const res = await es.explain({ index: target, id, query: body.query });
        return { matched: res.matched, explanation: res.explanation };
      } catch {
        return reply.code(404).send({ error: "no such document in this index" });
      }
    },
  );

  // Relevance-lab tuning: score a candidate ranking config against the judged
  // queries on demand, so the studio sliders can re-eval. Defaults to a sample
  // of the train split for a snappy loop; the run-eval CLI owns full official
  // runs. Reads the judged set from Postgres (cached after the first call).
  const evalData = db ? makeEvalDataCache(db) : null;
  app.post<{
    Body: { config?: unknown; split?: string; size?: number };
  }>("/eval", async (req, reply) => {
    if (!evalData) {
      return reply.code(503).send({ error: "eval requires a database connection" });
    }
    const ranking = coerceRankingConfig(req.body?.config);
    const { queries, judgmentsByQueryId } = await evalData();
    const { train, test } = trainTestSplit(queries.map((q) => q.queryId));
    const which =
      req.body?.split === "test" ? new Set(test) : req.body?.split === "all" ? null : new Set(train);
    let pool = which ? queries.filter((q) => which.has(q.queryId)) : queries;
    // Cap the worked set for an interactive loop (default 120, deterministic).
    const size = Number(req.body?.size);
    if (Number.isInteger(size) && size > 0 && size < pool.length) pool = pool.slice(0, size);

    const search = async (text: string): Promise<number[]> => {
      const res = await es.search<unknown>({ index, ...buildSearchBody(text, 100, { ranking }) });
      return res.hits.hits.map((h) => Number(h._id)).filter((id) => Number.isFinite(id));
    };
    const result = await runEval({ queries: pool, judgmentsByQueryId, search });
    return {
      split: req.body?.split === "test" ? "test" : req.body?.split === "all" ? "all" : "train",
      queryCount: result.queryCount,
      ndcg: result.ndcg,
      mrr: result.mrr,
      recall: result.recall,
      config: ranking,
    };
  });

  // Editor tools (Step 9): apply the current Postgres synonym rules to the live
  // indexes' search analyzer with no reindex (synonyms are query-time). This is
  // what the studio "Apply to search" button calls after an editor saves a rule.
  app.post("/synonyms/reload", async (_req, reply) => {
    if (!db) {
      return reply.code(503).send({ error: "synonyms reload requires a database connection" });
    }
    const rules = await loadSynonymRulesFromDb(db);
    const reloaded: string[] = [];
    for (const target of [index, shopIndex]) {
      if (await es.indices.exists({ index: target })) {
        await reloadSynonyms(es, target, rules);
        reloaded.push(target);
      }
    }
    return { applied: rules.length, indexes: reloaded };
  });

  return app;
}
