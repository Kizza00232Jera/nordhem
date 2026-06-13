import { Heart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { productsByIds } from "../../lib/catalog";
import { db } from "../../lib/db";
import { listFavoriteIds } from "../../lib/favorites-repo";
import { getCurrentUser } from "../../lib/session";
import { ProductCard } from "../components/product-card";

export const metadata: Metadata = { title: "Your favorites" };

export default async function FavoritesPage() {
  // Favorites require login (D43).
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/favorites");

  const ids = await listFavoriteIds(db(), user.id);
  const products = await productsByIds(ids);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 md:py-14">
      <h1 className="font-display text-4xl font-light">Your favorites</h1>

      {products.length === 0 ? (
        <div className="mt-10 rounded-md border border-line bg-card p-12 text-center">
          <Heart aria-hidden className="mx-auto size-10 text-ink-muted" strokeWidth={1.25} />
          <p className="mt-4 text-[15px] text-ink-muted">
            Tap the heart on any product to save it here.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-xs bg-pine px-6 py-3 text-[15px] font-semibold text-white hover:bg-pine-deep"
          >
            Browse the shop
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-5 lg:grid-cols-4">
          {products.map((p) => (
            <li key={p.productId}>
              <ProductCard product={p} favorited />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
