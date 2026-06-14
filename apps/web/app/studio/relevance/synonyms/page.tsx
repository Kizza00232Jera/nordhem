import type { Metadata } from "next";
import Link from "next/link";
import { SynonymsEditor } from "../../../components/synonyms-editor";
import { listSynonyms } from "../../../../lib/synonyms-repo";

export const metadata: Metadata = { title: "Synonyms" };

export default async function SynonymsPage() {
  const rules = await listSynonyms();
  const equivalent = rules.filter((r) => r.kind === "equivalent").length;
  const oneway = rules.length - equivalent;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <nav className="text-[13px] text-ink-muted">
        <Link href="/studio" className="hover:text-ink">Studio</Link> /{" "}
        <Link href="/studio/relevance" className="hover:text-ink">Relevance lab</Link> / Synonyms
      </nav>
      <h1 className="mt-2 font-display text-4xl font-light">Synonyms</h1>
      <p className="mt-2 max-w-2xl text-[14px] text-ink-muted">
        Synonyms let a shopper&rsquo;s word find a product that uses a different one: &ldquo;couch&rdquo;
        finds a sofa, &ldquo;bureau&rdquo; finds a dresser. Rules match at query time, so changing them
        never reindexes the catalog. {rules.length} rules ({equivalent} equivalent, {oneway} one-way).
      </p>
      <SynonymsEditor rules={rules} />
    </main>
  );
}
