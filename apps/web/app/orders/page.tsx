import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "../../lib/db";
import { formatPrice } from "../../lib/format";
import { listOrdersForUser } from "../../lib/orders-repo";
import { getCurrentUser } from "../../lib/session";
import { SignOutButton } from "../components/sign-out-button";

export const metadata: Metadata = { title: "Your orders" };

const dateFmt = new Intl.DateTimeFormat("en-IE", { dateStyle: "medium" });

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/orders");

  const orders = await listOrdersForUser(db(), user.id);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 md:py-14">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-light">Your orders</h1>
          <p className="mt-2 text-[14px] text-ink-muted">
            Signed in as {user.name ? `${user.name} (${user.email})` : user.email}
          </p>
        </div>
        <SignOutButton />
      </div>

      {orders.length === 0 ? (
        <div className="mt-10 rounded-md border border-line bg-card p-10 text-center">
          <p className="text-[15px] text-ink-muted">You have no orders yet.</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-xs bg-pine px-6 py-3 text-[15px] font-semibold text-white hover:bg-pine-deep"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.orderNumber}`}
                className="flex items-center gap-4 rounded-md border border-line bg-card p-4 transition-shadow hover:shadow-lift"
              >
                <div className="flex -space-x-3">
                  {order.items.slice(0, 3).map((item) =>
                    item.imageUrlSnapshot ? (
                      <span
                        key={item.productId}
                        className="relative size-12 overflow-hidden rounded-xs border-2 border-card bg-linen"
                      >
                        <Image
                          src={item.imageUrlSnapshot}
                          alt={item.nameSnapshot}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </span>
                    ) : null,
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">{order.orderNumber}</p>
                  <p className="text-[13px] text-ink-muted">
                    {dateFmt.format(order.createdAt)} ·{" "}
                    {order.items.reduce((n, i) => n + i.quantity, 0)} item(s)
                  </p>
                </div>
                <p className="tnum text-[15px] font-semibold">
                  {formatPrice(order.totalCents)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
