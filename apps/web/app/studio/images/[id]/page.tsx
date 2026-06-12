import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { poolForQuery, studioProductDetail, swapImage } from "../../../../lib/studio";

export const metadata: Metadata = { title: "Swap photo · Studio" };

export default async function SwapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const product = await studioProductDetail(id);
  if (!product) notFound();

  const pool = product.searchQuery ? await poolForQuery(product.searchQuery) : [];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-muted">
        <Link href="/studio" className="hover:text-ink">Studio</Link>
        {" / "}
        <Link href={`/studio/images?category=${product.category}`} className="hover:text-ink">
          Image review
        </Link>
        {" / "}
        <span aria-current="page">#{product.productId}</span>
      </nav>

      <div className="mt-4 flex flex-wrap items-start gap-8">
        <div>
          <h1 className="max-w-md text-xl font-semibold leading-snug">{product.name}</h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            pool query “{product.searchQuery}” · current status:{" "}
            <span className={product.status === "swapped" ? "font-semibold text-amber" : ""}>
              {product.status ?? "none"}
            </span>
          </p>
          {product.url && (
            <div className="relative mt-4 aspect-square w-64 overflow-hidden rounded-md shadow-lift">
              <Image src={product.url} alt={product.name} fill sizes="256px" className="object-cover" />
            </div>
          )}
          <p className="mt-2 text-[12px] text-ink-muted">
            current photo · {product.photographerName ?? "—"} / Unsplash
          </p>
        </div>

        <section className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold">
            Pick a replacement ({pool.length} in the pool)
          </h2>
          <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {pool.map((photo) => (
              <li key={photo.id}>
                <form action={swapImage}>
                  <input type="hidden" name="productId" value={product.productId} />
                  <input type="hidden" name="photoId" value={photo.id} />
                  <button
                    type="submit"
                    className="group relative block aspect-square w-full overflow-hidden rounded-xs bg-linen shadow-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-pine"
                    title={`Use photo by ${photo.photographerName}`}
                  >
                    <Image
                      src={photo.thumbUrl}
                      alt={`Photo by ${photo.photographerName}`}
                      fill
                      sizes="(max-width: 768px) 30vw, 15vw"
                      className="object-cover transition-opacity group-hover:opacity-80"
                    />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
