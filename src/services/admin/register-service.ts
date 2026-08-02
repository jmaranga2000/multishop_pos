import { db } from "@/lib/db";
import { buildSessionViewModel } from "@/services/shop/register-service";

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

  const normalizedSessions = await Promise.all(
    sessions.map(async (session) => buildSessionViewModel(session, session.shopId)),
  );

  return { business, sessions: normalizedSessions };
}
