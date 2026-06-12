import { SHOP_CATEGORIES, shopCategory } from "@nordhem/shared";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { studioProducts } from "../../../lib/studio";

export const metadata: Metadata = { title: "Image review · Studio" };

export default async function ImageReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: requested } = await searchParams;
  const category = shopCategory(requested ?? "") ? requested! : "beds";
  const products = await studioProducts(category);
  const swappedCount = products.filter((p) => p.status === "swapped").length;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-muted">
        <Link href="/studio" className="hover:text-ink">Studio</Link>
        {" / "}
        <span aria-current="page">Image review</span>
      </nav>
      <h1 className="mt-2 font-display text-3xl font-light">Image review</h1>
      <p className="mt-1 text-[13px] text-ink-muted">
        {products.length} products in this category · {swappedCount} hand-swapped ·
        photos represent the product type, click any to swap
      </p>

      <nav aria-label="Category filter" className="mt-6 overflow-x-auto">
        <ul className="flex gap-2">
          {SHOP_CATEGORIES.map((c) => (
            <li key={c.slug} className="shrink-0">
              <Link
                href={`/studio/images?category=${c.slug}`}
                className={
                  c.slug === category
                    ? "inline-block rounded-full bg-ink px-4 py-1.5 text-[13px] font-semibold text-paper"
                    : "inline-block rounded-full border border-line bg-card px-4 py-1.5 text-[13px] text-ink-muted hover:text-ink"
                }
              >
                {c.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <ul className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {products.map((p) => (
          <li key={p.productId}>
            <Link
              href={`/studio/images/${p.productId}`}
              className="group block overflow-hidden rounded-xs bg-card shadow-lift"
              title={p.name}
            >
              <div className="relative aspect-square bg-linen">
                {p.thumbUrl && (
                  <Image
                    src={p.thumbUrl}
                    alt={p.name}
                    fill
                    sizes="(max-width: 768px) 25vw, 12vw"
                    className="object-cover transition-opacity group-hover:opacity-85"
                  />
                )}
                {p.status === "swapped" && (
                  <span className="absolute left-1 top-1 rounded-full bg-amber px-1.5 py-0.5 text-[10px] font-bold text-ink">
                    swapped
                  </span>
                )}
              </div>
              <p className="line-clamp-1 px-1.5 py-1 text-[11px] text-ink-muted">
                {p.name}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
