import { NextResponse } from "next/server";
import { requireShop } from "@/lib/rbac";
import { getCreditMetrics } from "@/services/shop/ledger-query-service";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const user = await requireShop();

    const metrics = await getCreditMetrics(user.shopId);

    // Get top overdue customers
    const customers = await db.customer.findMany({
      where: { shopId: user.shopId },
      orderBy: { cachedOutstandingMinor: "desc" },
      take: 10,
    });

    const overdueCustomers = customers.filter((c) => {
      if ((c.cachedOutstandingMinor ?? 0) <= 0) return false;
      if (!c.lastTransactionAt) return false;
      const daysSinceLastTransaction =
        (new Date().getTime() - c.lastTransactionAt.getTime()) /
        (1000 * 60 * 60 * 24);
      return daysSinceLastTransaction > 30;
    });

    return NextResponse.json(
      {
        ...metrics,
        topCustomers: customers.slice(0, 5).map((c) => ({
          id: c.id,
          name: c.name,
          outstandingMinor: c.cachedOutstandingMinor,
          creditLimitMinor: c.creditLimit,
        })),
        overdueCustomers: overdueCustomers.slice(0, 5).map((c) => ({
          id: c.id,
          name: c.name,
          outstandingMinor: c.cachedOutstandingMinor,
          daysSinceLast: Math.floor(
            (new Date().getTime() - (c.lastTransactionAt?.getTime() ?? 0)) /
              (1000 * 60 * 60 * 24)
          ),
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[credit-metrics]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
