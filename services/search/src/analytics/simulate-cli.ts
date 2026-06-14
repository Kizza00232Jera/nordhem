import { createDb, ensureSchema, eq, searchEvents } from "@nordhem/db";
import type { SearchEventInput } from "@nordhem/shared";
import { loadEvalData } from "../eval/eval-data.ts";
import {
  buildSessionEvents,
  DEFAULT_CLICK_MODEL,
  mulberry32,
  rankByGrade,
  type SessionOpts,
} from "./simulate.ts";

/**
 * Generate synthetic search traffic from the WANDS relevance judgments and write
 * it to search_events with source='synthetic' (Step 10 slice 4). This populates
 * the analytics dashboards with realistic, position-biased, honestly-labelled
 * data without needing real visitors. It is NOT a ranking signal: the judgments
 * drive the simulated clicks, so feeding these back into ranking would be
 * circular. Re-run with --reset to replace the previous synthetic batch.
 *
 *   pnpm -F @nordhem/search simulate-traffic --queries 150 --max-sessions 14 --seed 7 --reset
 */
const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://nordhem:nordhem@localhost:5432/nordhem";

function numFlag(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const sampleSize = numFlag("queries", 150);
const maxSessions = numFlag("max-sessions", 14);
const seed = numFlag("seed", 7);
const reset = process.argv.includes("--reset");

// A handful of out-of-catalog terms that should legitimately find nothing, so
// the zero-result dashboard has honest signal. These are clearly not furniture.
const MISS_QUERIES = [
  "trampoline",
  "microwave oven",
  "car tyres",
  "garden hose",
  "bicycle helmet",
  "laptop charger",
  "running shoes",
];
// Hybrid is the common path; weight the pick toward it.
const MODES = ["lexical", "hybrid", "hybrid", "hybrid", "semantic"] as const;

const rng = mulberry32(seed);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)] as T;
const latency = () => 18 + Math.floor(rng() * 70);
const opts = (): SessionOpts => ({ mode: pick(MODES), latencyMs: latency() });

/** Fisher-Yates over a copy, using the seeded rng. */
function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}

function toRow(e: SearchEventInput) {
  if (e.type === "search") {
    return {
      type: "search" as const,
      query: e.query,
      mode: e.mode,
      resultCount: e.resultCount,
      zeroResult: e.resultCount === 0,
      latencyMs: e.latencyMs ?? null,
      source: "synthetic" as const,
    };
  }
  return {
    type: "click" as const,
    query: e.query,
    productId: e.productId,
    position: e.position,
    source: "synthetic" as const,
  };
}

const { db, close } = createDb(databaseUrl);
try {
  await ensureSchema(db);
  if (reset) {
    await db.delete(searchEvents).where(eq(searchEvents.source, "synthetic"));
    console.log("cleared previous synthetic events");
  }

  const { queries, judgmentsByQueryId } = await loadEvalData(db);
  const withJudgments = queries.filter((q) => (judgmentsByQueryId.get(q.queryId)?.length ?? 0) > 0);
  const sample = shuffle(withJudgments).slice(0, sampleSize);

  const events: SearchEventInput[] = [];
  // Zipf-ish popularity: the rank-1 query gets maxSessions, then maxSessions/2,
  // /3 ... so "top queries" has a realistic long tail.
  sample.forEach((q, rank) => {
    const sessions = Math.max(1, Math.round(maxSessions / (rank + 1)));
    const ranked = rankByGrade(judgmentsByQueryId.get(q.queryId) ?? []);
    for (let s = 0; s < sessions; s++) {
      events.push(...buildSessionEvents(q.query, ranked, opts(), rng, DEFAULT_CLICK_MODEL));
    }
  });
  // Honest zero-result traffic from out-of-catalog terms.
  for (const q of MISS_QUERIES) {
    const sessions = Math.max(1, Math.round(maxSessions / 4));
    for (let s = 0; s < sessions; s++) {
      events.push({ type: "search", query: q, mode: pick(MODES), resultCount: 0, latencyMs: latency() });
    }
  }

  const rows = events.map(toRow);
  for (let i = 0; i < rows.length; i += 1000) {
    await db.insert(searchEvents).values(rows.slice(i, i + 1000));
  }

  const searches = events.filter((e) => e.type === "search").length;
  const clicks = events.filter((e) => e.type === "click").length;
  console.log(
    `inserted ${rows.length} synthetic events (${searches} searches, ${clicks} clicks) ` +
      `over ${sample.length} queries + ${MISS_QUERIES.length} miss terms (seed ${seed})`,
  );
} finally {
  await close();
}
