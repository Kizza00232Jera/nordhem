import { shopCategory } from "@nordhem/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductCard } from "../../components/product-card";
import { productsByCategory } from "../../../lib/catalog";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = shopCategory((await params).slug);
  return { title: category ? category.title : "Category" };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = shopCategory(slug);
  if (!category) notFound();

  const products = await productsByCategory(slug);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 md:py-14">
      <header className="max-w-2xl">
        <h1 className="font-display text-4xl font-light md:text-5xl">
          {category.title}
        </h1>
        <p className="mt-3 text-[15px] text-ink-muted">{category.blurb}</p>
        <p className="mt-1 text-[13px] text-ink-muted">
          {products.length} products
        </p>
      </header>
      <ul className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <li key={p.productId}>
            <ProductCard product={p} />
          </li>
        ))}
      </ul>
    </main>
  );
}
