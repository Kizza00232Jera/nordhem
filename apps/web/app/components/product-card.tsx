import { Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ProductCard as ProductCardData } from "../../lib/catalog";
import { formatPrice } from "../../lib/format";

export function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <Link
      href={`/product/${product.slug}`}
      className="group block overflow-hidden rounded-md bg-card shadow-lift transition-shadow duration-200 hover:shadow-float"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-linen">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-ink-muted">
            photo pending
          </div>
        )}
      </div>
      <div className="px-4 pb-4 pt-3">
        <h3 className="line-clamp-2 min-h-[2.6em] text-[15px] leading-snug">
          {product.name}
        </h3>
        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <p className="tnum text-[15px] font-semibold">
            {formatPrice(product.priceCents)}
          </p>
          {product.averageRating !== null && product.ratingCount ? (
            <p className="flex items-center gap-1 text-[13px] text-ink-muted">
              <Star aria-hidden className="size-3.5 fill-amber text-amber" strokeWidth={1.5} />
              <span className="tnum">
                {product.averageRating.toFixed(1)} ({product.ratingCount})
              </span>
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
