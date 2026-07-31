import { db } from "@/lib/db";

export async function getAdminSalesPageData(businessId: string) {
  const [business, sales] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: businessId } }),
    db.sale.findMany({
      where: { shop: { businessId } },
      include: { shop: true, salesperson: true, payments: true, _count: { select: { items: true } } },
      orderBy: { occurredAt: "desc" },
      take: 200,
    }),
  ]);
  return { business, sales };
}

export async function getBusinessSalesInRange(businessId: string, start: Date, end: Date) {
  return db.sale.findMany({
    where: { shop: { businessId }, occurredAt: { gte: start, lte: end } },
    include: { shop: true, payments: true, _count: { select: { items: true } } },
    orderBy: { occurredAt: "desc" },
  });
}
