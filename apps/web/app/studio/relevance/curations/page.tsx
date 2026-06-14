import type { Metadata } from "next";
import Link from "next/link";
import { CurationsEditor } from "../../../components/curations-editor";

export const metadata: Metadata = { title: "Curations" };

export default function CurationsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <nav className="text-[13px] text-ink-muted">
        <Link href="/studio" className="hover:text-ink">Studio</Link> /{" "}
        <Link href="/studio/relevance" className="hover:text-ink">Relevance lab</Link> / Curations
      </nav>
      <h1 className="mt-2 font-display text-4xl font-light">Curations</h1>
      <p className="mt-2 max-w-2xl text-[14px] text-ink-muted">
        Hand-place results for a specific query: pin the products you want at the top, hide the ones you
        don&rsquo;t. Curations are read at query time, so a change is live on the next search, no reindex and
        no analyzer reload. They override ranking for that one query only.
      </p>
      <CurationsEditor />
    </main>
  );
}
