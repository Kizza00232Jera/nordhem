import { sql } from "@nordhem/db";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "../../lib/db";
import { searchBreaker, searchServiceHealthy } from "../../lib/search-source";

export const metadata: Metadata = { title: "System status" };
// Always probe live; a status page that caches its own status is a lie.
export const dynamic = "force-dynamic";

async function dbHealthy(): Promise<boolean> {
  try {
    await db().execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

type Tone = "ok" | "warn" | "down";
const DOT: Record<Tone, string> = {
  ok: "bg-pine",
  warn: "bg-amber",
  down: "bg-error",
};

function Row({ name, detail, label, tone }: { name: string; detail: string; label: string; tone: Tone }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line px-5 py-4 first:border-t-0">
      <div>
        <p className="text-[15px] font-medium">{name}</p>
        <p className="mt-0.5 text-[13px] text-ink-muted">{detail}</p>
      </div>
      <div className="flex items-center gap-2 whitespace-nowrap text-[13.5px]">
        <span className={`size-2.5 rounded-full ${DOT[tone]}`} aria-hidden />
        {label}
      </div>
    </div>
  );
}

export default async function StatusPage() {
  const [engineUp, dbUp] = await Promise.all([searchServiceHealthy(), dbHealthy()]);
  const breaker = searchBreaker().current;
  // The mode the storefront will actually serve right now.
  const lite = !engineUp || breaker === "open";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl font-light">System status</h1>
      <p className="mt-2 text-[14px] text-ink-muted">
        NORDHEM runs in two honest modes. <b>Full mode</b> uses the Elasticsearch engine on a real
        machine (semantic search, facets, synonyms). When that machine is asleep, the site stays up
        in <b>lite mode</b>, serving a Postgres full-text fallback.
      </p>

      <div
        className={`mt-6 inline-flex items-center gap-2.5 rounded-md px-4 py-2.5 text-[15px] font-semibold ${
          lite ? "bg-amber/15 text-ink" : "bg-pine/12 text-pine"
        }`}
      >
        <span className={`size-2.5 rounded-full ${lite ? "bg-amber" : "bg-pine"}`} aria-hidden />
        {lite ? "Lite mode" : "Full mode"}
      </div>

      <div className="mt-6 overflow-hidden rounded-md border border-line bg-card">
        <Row
          name="Storefront"
          detail="Next.js on Vercel"
          label="Operational"
          tone="ok"
        />
        <Row
          name="Catalog & accounts"
          detail="Postgres (Neon)"
          label={dbUp ? "Operational" : "Unreachable"}
          tone={dbUp ? "ok" : "down"}
        />
        <Row
          name="Search engine"
          detail="Elasticsearch on a self-hosted machine"
          label={engineUp ? "Operational" : "Unreachable"}
          tone={engineUp ? "ok" : "warn"}
        />
        <Row
          name="Circuit breaker"
          detail="Guards the search engine; opens after repeated failures"
          label={breaker === "closed" ? "Closed" : breaker === "open" ? "Open (serving lite)" : "Half-open (probing)"}
          tone={breaker === "closed" ? "ok" : breaker === "open" ? "warn" : "warn"}
        />
      </div>

      <p className="mt-6 text-[13.5px] text-ink-muted">
        {lite
          ? "Search is degraded but working: plain keyword results from Postgres, without facets, synonyms or semantic ranking."
          : "All systems operational. Full search is live."}{" "}
        <Link href="/" className="text-pine underline">
          Back to the shop
        </Link>
      </p>
    </main>
  );
}
