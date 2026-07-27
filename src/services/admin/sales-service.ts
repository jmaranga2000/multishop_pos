import { prisma } from "@/lib/prisma";

export async function getAdminSalesPageData(businessId: string) {
  const [business, sales] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: businessId } }),
    prisma.sale.findMany({
      where: { shop: { businessId } },
      include: { shop: true, salesperson: true, payments: true, _count: { select: { items: true } } },
      orderBy: { occurredAt: "desc" },
      take: 200,
    }),
  ]);
  return { business, sales };
}
