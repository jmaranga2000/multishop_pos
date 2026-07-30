import { db } from "@/lib/db";

export async function getAdminRegisterPageData(businessId: string) {
  const [business, sessions] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: businessId } }),
    db.registerSession.findMany({
      where: { shop: { businessId } },
      include: { shop: true, register: true, salesperson: true, _count: { select: { sales: true, transactions: true } } },
      orderBy: { openedAt: "desc" },
      take: 200,
    }),
  ]);
  return { business, sessions };
}
