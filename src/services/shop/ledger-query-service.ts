import { db } from "@/lib/db";

export interface LedgerQueryParams {
  customerId: string;
  shopId: string;
  startDate?: Date;
  endDate?: Date;
  entryType?: string;
  limit?: number;
  offset?: number;
}

export async function getLedgerEntries(params: LedgerQueryParams) {
  const {
    customerId,
    shopId,
    startDate,
    endDate,
    entryType,
    limit = 100,
    offset = 0,
  } = params;

  const where: any = { customerId, shopId };
  
  if (startDate || endDate) {
    where.occurredAt = {};
    if (startDate) where.occurredAt.$gte = startDate;
    if (endDate) where.occurredAt.$lte = endDate;
  }

  if (entryType) {
    where.type = entryType;
  }

  const entries = await db.ledgerEntry.findMany({
    where,
    orderBy: { occurredAt: "desc" },
    skip: offset,
    take: limit,
  });

  const total = await db.ledgerEntry.count({ where });

  return { entries, total };
}

export async function getCustomerStatement(customerId: string, shopId: string) {
  const customer = await db.customer.findFirst({
    where: { id: customerId, shopId },
  });

  if (!customer) throw new Error("Customer not found");

  const ledgerEntries = await db.ledgerEntry.findMany({
    where: { customerId, shopId },
    orderBy: { occurredAt: "asc" },
  });

  // Calculate aged balance
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const current = ledgerEntries
    .filter((e) => e.occurredAt >= thirtyDaysAgo)
    .reduce((sum, e) => sum + (e.debitMinor ?? 0) - (e.creditMinor ?? 0), 0);

  const thirtyPlus = ledgerEntries
    .filter((e) => e.occurredAt >= sixtyDaysAgo && e.occurredAt < thirtyDaysAgo)
    .reduce((sum, e) => sum + (e.debitMinor ?? 0) - (e.creditMinor ?? 0), 0);

  const sixtyPlus = ledgerEntries
    .filter((e) => e.occurredAt >= ninetyDaysAgo && e.occurredAt < sixtyDaysAgo)
    .reduce((sum, e) => sum + (e.debitMinor ?? 0) - (e.creditMinor ?? 0), 0);

  const ninetyPlus = ledgerEntries
    .filter((e) => e.occurredAt < ninetyDaysAgo)
    .reduce((sum, e) => sum + (e.debitMinor ?? 0) - (e.creditMinor ?? 0), 0);

  return {
    customer,
    ledgerEntries,
    agedBalance: { current, thirtyPlus, sixtyPlus, ninetyPlus },
  };
}

export async function getCreditMetrics(shopId: string) {
  const customers = await db.customer.findMany({ where: { shopId } });

  let totalOutstanding = 0;
  let totalOverdue = 0;
  let customerCount = 0;
  let overdueCustomerCount = 0;

  for (const customer of customers) {
    totalOutstanding += Number(customer.cachedOutstandingMinor ?? 0);
    customerCount++;

    // Check if customer is overdue (has outstanding balance and last transaction > 30 days ago)
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
    (sum, c) => sum + Number(c.creditLimit ?? 0),
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
