import { SHOP_CATEGORIES } from "@nordhem/shared";
import { Heart, Search, ShoppingBag } from "lucide-react";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper">
      <p className="bg-linen px-4 py-1.5 text-center text-[13px] text-ink-muted">
        Free delivery over €499 · 365-day returns
      </p>
      <div className="mx-auto flex w-full max-w-7xl items-center gap-6 px-4 py-4 sm:px-6">
        <Link href="/" className="shrink-0 text-lg font-bold tracking-[0.18em]">
          NORDHEM
        </Link>

        <form action="/search" className="relative mx-auto w-full max-w-xl">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-muted"
            strokeWidth={1.75}
          />
          <input
            type="search"
            name="q"
            placeholder="Search beds, sofas, lighting…"
            aria-label="Search products"
            className="h-11 w-full rounded-xs border border-line bg-card pl-11 pr-4 text-[15px] placeholder:text-ink-muted"
          />
        </form>

        <div className="flex shrink-0 items-center gap-1 text-ink-muted">
          <span
            className="inline-flex size-11 items-center justify-center"
            title="Favorites arrive with accounts"
          >
            <Heart aria-hidden className="size-5" strokeWidth={1.75} />
            <span className="sr-only">Favorites (coming soon)</span>
          </span>
          <span
            className="inline-flex size-11 items-center justify-center"
            title="Cart arrives with accounts"
          >
            <ShoppingBag aria-hidden className="size-5" strokeWidth={1.75} />
            <span className="sr-only">Cart (coming soon)</span>
          </span>
        </div>
      </div>

      <nav aria-label="Categories" className="mx-auto w-full max-w-7xl overflow-x-auto px-4 sm:px-6">
        <ul className="flex gap-6 pb-3 text-[14px]">
          {SHOP_CATEGORIES.map((c) => (
            <li key={c.slug} className="shrink-0">
              <Link
                href={`/category/${c.slug}`}
                className="text-ink-muted transition-colors duration-150 hover:text-ink"
              >
                {c.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
