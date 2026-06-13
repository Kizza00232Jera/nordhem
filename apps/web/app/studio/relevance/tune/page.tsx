import type { Metadata } from "next";
import Link from "next/link";
import { TuneControls } from "../../../components/tune-controls";

export const metadata: Metadata = { title: "Tune ranking" };

export default function TunePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <nav className="text-[13px] text-ink-muted">
        <Link href="/studio" className="hover:text-ink">Studio</Link> /{" "}
        <Link href="/studio/relevance" className="hover:text-ink">Relevance lab</Link> / tune
      </nav>
      <h1 className="mt-2 font-display text-4xl font-light">Tune ranking</h1>
      <p className="mt-2 max-w-2xl text-[14px] text-ink-muted">
        Move the sliders and re-score against the judged queries. Each knob is a
        ranking lever: field boosts decide which field a match counts most in,
        the fuzzy prefix length stops short typos turning one word into another,
        the phrase boost rewards the query words appearing together, and
        popularity nudges well-reviewed products. Runs on a train-split sample
        so the loop stays fast; confirm a winner on the full set with the
        run-eval CLI before graduating it.
      </p>
      <div className="mt-8">
        <TuneControls />
      </div>
    </main>
  );
}
