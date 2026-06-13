import type { Metadata } from "next";
import Link from "next/link";
import { ExplainView } from "../../../components/explain-view";

export const metadata: Metadata = { title: "Explain score" };

export default function ExplainPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <nav className="text-[13px] text-ink-muted">
        <Link href="/studio" className="hover:text-ink">Studio</Link> /{" "}
        <Link href="/studio/relevance" className="hover:text-ink">Relevance lab</Link> / explain
      </nav>
      <h1 className="mt-2 font-display text-4xl font-light">Explain a score</h1>
      <p className="mt-2 max-w-2xl text-[14px] text-ink-muted">
        Pick a query and a product id and see Elasticsearch&rsquo;s own score
        breakdown: the final relevance score and every factor that produced it,
        from the per-field matches down to the BM25 term-frequency and inverse-
        document-frequency leaves. This is how you find out why a result ranked
        where it did, rather than guessing.
      </p>
      <div className="mt-8">
        <ExplainView />
      </div>
    </main>
  );
}
