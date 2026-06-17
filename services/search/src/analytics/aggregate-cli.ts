import { createDb, ensureSchema } from "@nordhem/db";
import {
  affinityBoostWeight,
  aggregateAffinities,
  DEFAULT_AFFINITY_BOOST,
} from "./affinity.ts";
import { readClickObservations, replaceAffinities, type EventSource } from "./affinity-repo.ts";
import { DEFAULT_CLICK_MODEL } from "./simulate.ts";

/**
 * The learning loop's batch job (Step 11a). Reads logged clicks from
 * search_events, corrects them for position bias, and REPLACES the
 * click_affinity table so the next search boosts what people actually click.
 * Idempotent per source — safe to run nightly (cron) or on demand.
 *
 * Defaults to the LIVE stream: the synthetic generator's clicks are derived
 * from the judgments, so a synthetic-fed loop evaluated on those judgments is
 * circular. --source synthetic is allowed only to DEMO the mechanism end to end
 * when there is no live traffic yet, and it is labelled as such in the table.
 *
 *   pnpm -F @nordhem/search aggregate-clicks [--source live|synthetic] [--decay 0.7] [--dry-run]
 */
const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://nordhem:nordhem@localhost:5432/nordhem";

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const source: EventSource = flag("source") === "synthetic" ? "synthetic" : "live";
const decay = Number(flag("decay")) > 0 ? Number(flag("decay")) : DEFAULT_CLICK_MODEL.decay;
const dryRun = process.argv.includes("--dry-run");
// Don't boost a product until at least this many clicks (default 1 = off).
const minObservations = Number(flag("min-observations")) > 0 ? Number(flag("min-observations")) : 1;
// Recency half-life in days (default 0 = off); recent clicks weigh more.
const halfLifeDays = Number(flag("half-life-days")) > 0 ? Number(flag("half-life-days")) : 0;

const { db, close } = createDb(databaseUrl);
try {
  await ensureSchema(db);

  const clicks = await readClickObservations(db, source);
  const halfLifeMs = halfLifeDays > 0 ? halfLifeDays * 24 * 60 * 60 * 1000 : undefined;
  const rows = aggregateAffinities(clicks, {
    decay,
    minObservations,
    ...(halfLifeMs ? { halfLifeMs, now: Date.now() } : {}),
  });

  console.log(
    `read ${clicks.length} ${source} clicks -> ${rows.length} (query, product) affinities ` +
      `(decay ${decay}, min-obs ${minObservations}${halfLifeDays ? `, half-life ${halfLifeDays}d` : ""})`,
  );

  // A small preview so a run is legible without querying the table.
  for (const r of rows.slice(0, 10)) {
    const weight = affinityBoostWeight(r.affinity, DEFAULT_AFFINITY_BOOST).toFixed(2);
    console.log(
      `  ${r.query} -> #${r.productId}  obs ${r.observations}  affinity ${r.affinity.toFixed(3)}  boost ${weight}`,
    );
  }

  if (dryRun) {
    console.log("dry run: click_affinity not written");
  } else {
    const written = await replaceAffinities(db, rows, source);
    console.log(`wrote ${written} ${source} affinities to click_affinity`);
  }
} finally {
  await close();
}
