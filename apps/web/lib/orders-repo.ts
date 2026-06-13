import { desc, eq, orderItems, orders, sql, type DbOrTx } from "@nordhem/db";

export interface OrderLine {
  productId: number;
  nameSnapshot: string;
  slugSnapshot: string;
  imageUrlSnapshot: string | null;
  unitPriceCents: number;
  quantity: number;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  status: string;
  shipFullName: string;
  shipLine1: string;
  shipLine2: string | null;
  shipCity: string;
  shipPostalCode: string;
  shipCountry: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  createdAt: Date;
  items: OrderLine[];
}

const orderColumns = {
  id: orders.id,
  orderNumber: orders.orderNumber,
  status: orders.status,
  shipFullName: orders.shipFullName,
  shipLine1: orders.shipLine1,
  shipLine2: orders.shipLine2,
  shipCity: orders.shipCity,
  shipPostalCode: orders.shipPostalCode,
  shipCountry: orders.shipCountry,
  subtotalCents: orders.subtotalCents,
  shippingCents: orders.shippingCents,
  totalCents: orders.totalCents,
  createdAt: orders.createdAt,
};

async function itemsFor(db: DbOrTx, orderId: string): Promise<OrderLine[]> {
  return db
    .select({
      productId: orderItems.productId,
      nameSnapshot: orderItems.nameSnapshot,
      slugSnapshot: orderItems.slugSnapshot,
      imageUrlSnapshot: orderItems.imageUrlSnapshot,
      unitPriceCents: orderItems.unitPriceCents,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(orderItems.productId);
}

/** One order owned by this user (ownership enforced in the query), or null. */
export async function getOrderForUser(
  db: DbOrTx,
  userId: string,
  orderNumber: string,
): Promise<OrderRecord | null> {
  const [order] = await db
    .select(orderColumns)
    .from(orders)
    .where(sql`${orders.orderNumber} = ${orderNumber} AND ${orders.userId} = ${userId}`);
  if (!order) return null;
  return { ...order, items: await itemsFor(db, order.id) };
}

/** A user's orders, newest first, each with its snapshotted lines. */
export async function listOrdersForUser(
  db: DbOrTx,
  userId: string,
): Promise<OrderRecord[]> {
  const rows = await db
    .select(orderColumns)
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
  const out: OrderRecord[] = [];
  for (const order of rows) {
    out.push({ ...order, items: await itemsFor(db, order.id) });
  }
  return out;
}
