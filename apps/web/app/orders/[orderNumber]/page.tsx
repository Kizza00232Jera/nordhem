import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "../../../lib/db";
import { formatPrice } from "../../../lib/format";
import { getOrderForUser } from "../../../lib/orders-repo";
import { getCurrentUser } from "../../../lib/session";

interface Props {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ placed?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Order ${(await params).orderNumber}` };
}

const dateFmt = new Intl.DateTimeFormat("en-IE", { dateStyle: "long" });

export default async function OrderPage({ params, searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { orderNumber } = await params;
  const { placed } = await searchParams;
  const order = await getOrderForUser(db(), user.id, orderNumber);
  if (!order) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 md:py-14">
      {placed && (
        <div className="mb-8 flex items-center gap-3 rounded-md bg-linen px-5 py-4">
          <CheckCircle2 aria-hidden className="size-6 text-pine" strokeWidth={1.75} />
          <p className="text-[15px] font-medium">
            Thank you — your order is confirmed.
          </p>
        </div>
      )}

      <h1 className="font-display text-4xl font-light">Order {order.orderNumber}</h1>
      <p className="mt-2 text-[14px] text-ink-muted">
        Placed {dateFmt.format(order.createdAt)} · {order.status}
      </p>

      <ul className="mt-8 divide-y divide-line border-y border-line">
        {order.items.map((item) => (
          <li key={item.productId} className="flex gap-4 py-4">
            <Link
              href={`/product/${item.slugSnapshot}`}
              className="relative size-20 shrink-0 overflow-hidden rounded-xs bg-linen"
            >
              {item.imageUrlSnapshot && (
                <Image
                  src={item.imageUrlSnapshot}
                  alt={item.nameSnapshot}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              )}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <Link
                href={`/product/${item.slugSnapshot}`}
                className="text-[15px] leading-snug hover:underline"
              >
                {item.nameSnapshot}
              </Link>
              <p className="mt-1 text-[13px] text-ink-muted">
                Qty {item.quantity} · {formatPrice(item.unitPriceCents)}
              </p>
            </div>
            <p className="tnum self-center text-[15px] font-semibold">
              {formatPrice(item.unitPriceCents * item.quantity)}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <section>
          <h2 className="text-[15px] font-semibold">Shipping to</h2>
          <address className="mt-2 text-[14px] not-italic leading-relaxed text-ink-muted">
            {order.shipFullName}
            <br />
            {order.shipLine1}
            {order.shipLine2 && (
              <>
                <br />
                {order.shipLine2}
              </>
            )}
            <br />
            {order.shipPostalCode} {order.shipCity}
            <br />
            {order.shipCountry}
          </address>
        </section>
        <section>
          <h2 className="text-[15px] font-semibold">Totals</h2>
          <dl className="mt-2 space-y-2 text-[14px]">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Subtotal</dt>
              <dd className="tnum">{formatPrice(order.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Shipping</dt>
              <dd className="tnum">
                {order.shippingCents === 0 ? "Free" : formatPrice(order.shippingCents)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-[16px] font-semibold">
              <dt>Total</dt>
              <dd className="tnum">{formatPrice(order.totalCents)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <Link
        href="/orders"
        className="mt-10 inline-block text-[14px] text-pine hover:underline"
      >
        View all orders
      </Link>
    </main>
  );
}
