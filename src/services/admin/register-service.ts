import { prisma } from "@/lib/prisma";

export async function getAdminRegisterPageData(businessId: string) {
  const [business, sessions] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: businessId } }),
    prisma.registerSession.findMany({
      where: { shop: { businessId } },
      include: { shop: true, register: true, salesperson: true, _count: { select: { sales: true, transactions: true } } },
      orderBy: { openedAt: "desc" },
      take: 200,
    }),
  ]);
  return { business, sessions };
}
