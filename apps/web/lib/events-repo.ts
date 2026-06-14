import { type Db, searchEvents } from "@nordhem/db";
import type { SearchEventInput } from "@nordhem/shared";

/** Real visitor traffic vs the simulated-traffic generator (Step 10 slice 4). */
export type EventSource = "live" | "synthetic";

type EventRow = typeof searchEvents.$inferInsert;

/**
 * Flatten a validated event into its row. A search fills the search columns and
 * derives zeroResult; a click fills the click columns. The other side's columns
 * are simply omitted, so they land NULL.
 */
function toRow(event: SearchEventInput, source: EventSource): EventRow {
  if (event.type === "search") {
    return {
      type: "search",
      query: event.query,
      mode: event.mode,
      resultCount: event.resultCount,
      zeroResult: event.resultCount === 0,
      latencyMs: event.latencyMs ?? null,
      source,
    };
  }
  return {
    type: "click",
    query: event.query,
    productId: event.productId,
    position: event.position,
    source,
  };
}

/** Record one event (defaults to a real visitor). */
export async function recordEvent(
  db: Db,
  event: SearchEventInput,
  source: EventSource = "live",
): Promise<void> {
  await db.insert(searchEvents).values(toRow(event, source));
}

/** Record a batch in a single insert; an empty batch is a no-op. */
export async function recordEvents(
  db: Db,
  events: SearchEventInput[],
  source: EventSource = "live",
): Promise<void> {
  if (events.length === 0) return;
  await db.insert(searchEvents).values(events.map((e) => toRow(e, source)));
}
