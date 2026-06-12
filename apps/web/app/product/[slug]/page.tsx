import { shopCategory } from "@nordhem/shared";
import { Check, Star } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "../../components/product-card";
import { productBySlug, productsByCategory } from "../../../lib/catalog";
import { formatPrice } from "../../../lib/format";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await productBySlug((await params).slug);
  return { title: product ? product.name : "Product" };
}

function parseFeatures(features: string | null): Array<[string, string]> {
  if (!features) return [];
  const seen = new Set<string>();
  const rows: Array<[string, string]> = [];
  for (const part of features.split("|")) {
    const [key, ...rest] = part.split(":");
    const k = key?.trim() ?? "";
    const v = rest.join(":").trim();
    // The raw feature dump is noisy; keep readable, deduped, non-flag rows.
    if (!k || !v || v === "no" || v === "yes" || seen.has(k) || k.length > 40) continue;
    seen.add(k);
    rows.push([k.replace(/([a-z])([A-Z])/g, "$1 $2"), v]);
    if (rows.length >= 10) break;
  }
  return rows;
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await productBySlug(slug);
  if (!product) notFound();

  const category = shopCategory(product.category);
  const similar = (await productsByCategory(product.category))
    .filter((p) => p.productId !== product.productId)
    .slice(0, 4);
  const specs = parseFeatures(product.features);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 md:py-14">
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-muted">
        <Link href="/" className="hover:text-ink">Home</Link>
        {" / "}
        {category && (
          <>
            <Link href={`/category/${category.slug}`} className="hover:text-ink">
              {category.title}
            </Link>
            {" / "}
          </>
        )}
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[3fr_2fr]">
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-linen shadow-lift">
          {product.imageUrl && (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-cover"
            />
          )}
        </div>

        <div className="lg:sticky lg:top-36 lg:self-start">
          <h1 className="text-2xl font-semibold leading-snug">{product.name}</h1>

          {product.averageRating !== null && product.ratingCount ? (
            <p className="mt-2 flex items-center gap-1.5 text-[14px] text-ink-muted">
              <Star aria-hidden className="size-4 fill-amber text-amber" strokeWidth={1.5} />
              <span className="tnum">
                {product.averageRating.toFixed(1)} · {product.ratingCount} ratings
              </span>
            </p>
          ) : null}

          <p className="tnum mt-5 font-display text-5xl font-light">
            {formatPrice(product.priceCents)}
          </p>

          <p className="mt-4 flex items-center gap-2 text-[14px] text-pine">
            <Check aria-hidden className="size-4" strokeWidth={2} />
            In stock — ships in 2-4 days
          </p>

          <button
            type="button"
            disabled
            aria-describedby="cart-note"
            className="mt-6 w-full cursor-not-allowed rounded-xs bg-pine px-6 py-3.5 text-[15px] font-semibold text-white opacity-50"
          >
            Add to cart
          </button>
          <p id="cart-note" className="mt-2 text-[13px] text-ink-muted">
            Cart and checkout open with customer accounts (build step 5).
          </p>

          {product.description && (
            <section className="mt-8 border-t border-line pt-6">
              <h2 className="text-[15px] font-semibold">About this product</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
                {product.description}
              </p>
            </section>
          )}

          {specs.length > 0 && (
            <section className="mt-6 border-t border-line pt-6">
              <h2 className="text-[15px] font-semibold">Details</h2>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[14px]">
                {specs.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-ink-muted">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {product.photographerName && (
            <p className="mt-8 text-[12px] text-ink-muted">
              Photo represents the product type ·{" "}
              <a
                href={product.photographerUrl ?? "#"}
                className="underline hover:text-ink"
                rel="noreferrer"
              >
                {product.photographerName}
              </a>{" "}
              / Unsplash
            </p>
          )}
        </div>
      </div>

      {similar.length > 0 && (
        <section className="mt-20">
          <h2 className="font-display text-3xl font-light">
            More {category?.title.toLowerCase() ?? "like this"}
          </h2>
          <ul className="mt-8 grid grid-cols-2 gap-5 lg:grid-cols-4">
            {similar.map((p) => (
              <li key={p.productId}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
