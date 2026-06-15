import type { Metadata } from "next";
import Link from "next/link";
import { db } from "../../../lib/db";
import {
  analyticsSummary,
  ctrByPosition,
  latencyPercentiles,
  topQueries,
  zeroResultQueries,
} from "../../../lib/analytics-repo";

export const metadata: Metadata = { title: "Search analytics" };
// A live KPI board: always render against the current events, never a build snapshot.
export const dynamic = "force-dynamic";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const num = (n: number) => n.toLocaleString("en-US");
const ms = (n: number | null) => (n === null ? "--" : `${Math.round(n)} ms`);

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md bg-card p-5 shadow-lift">
      <p className="text-[12px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="tnum mt-1.5 font-display text-3xl font-light">{value}</p>
      {hint && <p className="mt-1 text-[12px] text-ink-muted">{hint}</p>}
    </div>
  );
}

export default async function AnalyticsPage() {
  const conn = db();
  const [summary, top, zero, ctr, latency] = await Promise.all([
    analyticsSummary(conn),
    topQueries(conn, 12),
    zeroResultQueries(conn, 12),
    ctrByPosition(conn, 10),
    latencyPercentiles(conn),
  ]);

  const empty = summary.totalSearches === 0 && summary.totalClicks === 0;
  const maxCtr = Math.max(0, ...ctr.map((c) => c.ctr));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <nav className="text-[13px] text-ink-muted">
        <Link href="/studio" className="hover:text-ink">
          Studio
        </Link>{" "}
        / Analytics
      </nav>
      <h1 className="mt-2 font-display text-4xl font-light">Search analytics</h1>
      <p className="mt-2 max-w-2xl text-[14px] text-ink-muted">
        First-party search telemetry, recorded in Postgres so it keeps working in lite mode. What
        people search, what finds nothing, where they click, and how fast the engine answers.
      </p>

      {summary.syntheticSearches > 0 && (
        <p className="mt-3 inline-block rounded-xs border border-line bg-linen px-3 py-1.5 text-[12.5px] text-ink-muted">
          Includes {num(summary.syntheticSearches)} simulated searches from the traffic generator,
          labelled <b>synthetic</b> and counted honestly alongside {num(summary.liveSearches)} live
          ones.
        </p>
      )}

      {empty ? (
        <div className="mt-10 rounded-md border border-dashed border-line p-10 text-center text-[14px] text-ink-muted">
          No events recorded yet. Run a few searches on the storefront, or generate simulated
          traffic, and the board fills in.
        </div>
      ) : (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Searches" value={num(summary.totalSearches)} hint={`${num(summary.distinctQueries)} distinct queries`} />
            <StatCard
              label="Zero-result rate"
              value={pct(summary.zeroResultRate)}
              hint="searches that found nothing"
            />
            <StatCard label="Result clicks" value={num(summary.totalClicks)} hint="clicked results" />
            <StatCard label="Latency p50 / p95" value={`${ms(latency.p50)} / ${ms(latency.p95)}`} hint={`p99 ${ms(latency.p99)}`} />
          </section>

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <section>
              <h2 className="text-[15px] font-semibold">Top queries</h2>
              <div className="mt-3 overflow-x-auto rounded-md border border-line">
                <table className="w-full border-collapse text-[13.5px]">
                  <thead>
                    <tr className="bg-linen text-left">
                      <th className="px-4 py-2.5 font-semibold">Query</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Searches</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Zero-result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((q) => (
                      <tr key={q.query} className="border-t border-line hover:bg-paper">
                        <td className="px-4 py-2.5">{q.query}</td>
                        <td className="tnum px-4 py-2.5 text-right">{num(q.searches)}</td>
                        <td className="tnum px-4 py-2.5 text-right text-ink-muted">
                          {q.zeroResults > 0 ? pct(q.zeroResults / q.searches) : "--"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold">Zero-result queries</h2>
              <p className="mt-1 text-[12.5px] text-ink-muted">The editor backlog: searches that need a synonym or a curation.</p>
              <div className="mt-2 overflow-x-auto rounded-md border border-line">
                {zero.length === 0 ? (
                  <p className="p-6 text-center text-[13.5px] text-ink-muted">
                    No zero-result searches. Every query found something.
                  </p>
                ) : (
                  <table className="w-full border-collapse text-[13.5px]">
                    <thead>
                      <tr className="bg-linen text-left">
                        <th className="px-4 py-2.5 font-semibold">Query</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Searches</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zero.map((q) => (
                        <tr key={q.query} className="border-t border-line hover:bg-paper">
                          <td className="px-4 py-2.5">{q.query}</td>
                          <td className="tnum px-4 py-2.5 text-right">{num(q.searches)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>

          <section className="mt-8">
            <h2 className="text-[15px] font-semibold">Click-through rate by position</h2>
            <p className="mt-1 max-w-2xl text-[12.5px] text-ink-muted">
              CTR at rank p is clicks at p over impressions at p (a search that returned at least p
              results counts as an impression for position p). A steep top-heavy curve is position
              bias, the thing the learning loop will later correct for.
            </p>
            <div className="mt-3 space-y-1.5">
              {ctr.map((c) => (
                <div key={c.position} className="flex items-center gap-3 text-[13px]">
                  <span className="tnum w-6 text-right text-ink-muted">{c.position}</span>
                  <div className="h-5 flex-1 overflow-hidden rounded-xs bg-linen">
                    <div
                      className="h-full bg-pine"
                      style={{ width: maxCtr > 0 ? `${(c.ctr / maxCtr) * 100}%` : "0%" }}
                    />
                  </div>
                  <span className="tnum w-16 text-right">{pct(c.ctr)}</span>
                  <span className="tnum w-28 text-right text-ink-muted">
                    {num(c.clicks)} / {num(c.impressions)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
