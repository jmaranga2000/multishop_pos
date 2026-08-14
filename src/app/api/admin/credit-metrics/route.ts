import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/rbac";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireAdmin();

    const shopIds = await db.shop.findMany({
      where: { businessId: user.businessId },
      select: { id: true },
    });

    const shopIdList = shopIds.map((shop) => shop.id);
    const metrics = await getCreditMetricsForBusiness(user.businessId);
    const customers = await db.customer.findMany({
      where: { shopId: { in: shopIdList } },
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

async function getCreditMetricsForBusiness(businessId: string) {
  const shops = await db.shop.findMany({
    where: { businessId },
    select: { id: true },
  });

  const shopIds = shops.map((shop) => shop.id);
  const customers = await db.customer.findMany({
    where: { shopId: { in: shopIds } },
  });

  let totalOutstanding = 0;
  let totalOverdue = 0;
  let customerCount = 0;
  let overdueCustomerCount = 0;

  for (const customer of customers) {
    totalOutstanding += Number(customer.cachedOutstandingMinor ?? 0);
    customerCount++;

    if (
      (customer.cachedOutstandingMinor ?? 0) > 0 &&
      customer.lastTransactionAt &&
      new Date().getTime() - customer.lastTransactionAt.getTime() > 30 * 24 * 60 * 60 * 1000
    ) {
      totalOverdue += Number(customer.cachedOutstandingMinor ?? 0);
      overdueCustomerCount++;
    }
  }

  const totalCreditLimit = customers.reduce(
    (sum, customer) => sum + Number(customer.creditLimit ?? 0),
    0
  );

  const utilizationRate =
    totalCreditLimit > 0
      ? ((totalOutstanding / totalCreditLimit) * 100).toFixed(2)
      : "0.00";

  return {
    totalOutstanding,
    totalOverdue,
    totalCreditLimit,
    utilizationRate,
    customerCount,
    overdueCustomerCount,
    activeCredit: totalOutstanding > 0,
  };
}
