import { Images, SearchCode } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Studio" };

export default function StudioHome() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl font-light">Search Studio</h1>
      <p className="mt-2 max-w-xl text-[14px] text-ink-muted">
        The shop&rsquo;s back office. Relevance tooling lands here step by
        step — image review first, the eval lab and editor tools follow.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li>
          <Link
            href="/studio/images"
            className="flex items-start gap-4 rounded-md bg-card p-5 shadow-lift transition-shadow hover:shadow-float"
          >
            <Images aria-hidden className="mt-0.5 size-5 text-pine" strokeWidth={1.75} />
            <span>
              <span className="block text-[15px] font-semibold">Image review</span>
              <span className="mt-1 block text-[13px] leading-relaxed text-ink-muted">
                Audit the auto-assigned Unsplash photos and hand-swap the
                mismatches per product.
              </span>
            </span>
          </Link>
        </li>
        <li>
          <span className="flex items-start gap-4 rounded-md border border-dashed border-line p-5 text-ink-muted">
            <SearchCode aria-hidden className="mt-0.5 size-5" strokeWidth={1.75} />
            <span>
              <span className="block text-[15px] font-semibold">Relevance lab</span>
              <span className="mt-1 block text-[13px] leading-relaxed">
                nDCG over 480 judged queries — arrives in build step 6.
              </span>
            </span>
          </span>
        </li>
      </ul>
    </main>
  );
}
