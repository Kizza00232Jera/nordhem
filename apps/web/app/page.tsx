import { SHOP_CATEGORIES } from "@nordhem/shared";
import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "./components/product-card";
import { categoryShowcase, featuredProducts } from "../lib/catalog";

// The home page reads live catalog data from Postgres; without this it
// would prerender at build time (and CI has no database).
export const dynamic = "force-dynamic";

export default async function Home() {
  const [showcase, featured] = await Promise.all([
    categoryShowcase(),
    featuredProducts(8),
  ]);
  const hero = showcase.get("sofas") ?? featured[0];

  return (
    <main>
      <section className="bg-linen">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 md:py-24">
          <div>
            <h1 className="font-display text-[clamp(2.75rem,6vw,5.25rem)] font-light leading-[1.05]">
              sleep, live,
              <br />
              <em className="text-pine">store.</em>
            </h1>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-ink-muted">
              Nordic home goods chosen from 42,994 real products — and a search
              bar that actually understands what you mean.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/category/beds"
                className="rounded-xs bg-pine px-6 py-3 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-pine-deep"
              >
                Shop beds
              </Link>
              <Link
                href="/search?q=reading+chair"
                className="rounded-xs border border-line bg-card px-6 py-3 text-[15px] font-semibold transition-colors duration-150 hover:border-ink-muted"
              >
                Try the search
              </Link>
            </div>
          </div>
          {hero?.imageUrl && (
            <div className="relative aspect-[4/5] max-h-[520px] overflow-hidden rounded-xl shadow-lift">
              <Image
                src={hero.imageUrl}
                alt={hero.name}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-24">
        <h2 className="font-display text-3xl font-light">Rooms to live in</h2>
        <ul className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-4">
          {SHOP_CATEGORIES.map((category) => {
            const sample = showcase.get(category.slug);
            return (
              <li key={category.slug}>
                <Link
                  href={`/category/${category.slug}`}
                  className="group block overflow-hidden rounded-md bg-card shadow-lift transition-shadow duration-200 hover:shadow-float"
                >
                  <div className="relative aspect-square overflow-hidden bg-linen">
                    {sample?.imageThumbUrl && (
                      <Image
                        src={sample.imageThumbUrl}
                        alt=""
                        fill
                        sizes="(max-width: 768px) 50vw, 25vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                      />
                    )}
                  </div>
                  <div className="px-4 py-3">
                    <h3 className="text-[15px] font-semibold">{category.title}</h3>
                    <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-muted">
                      {category.blurb}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 md:pb-24">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-3xl font-light">Loved by many</h2>
          <p className="text-[13px] text-ink-muted">ranked by real review counts</p>
        </div>
        <ul className="mt-8 grid grid-cols-2 gap-5 lg:grid-cols-4">
          {featured.map((p) => (
            <li key={p.productId}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
