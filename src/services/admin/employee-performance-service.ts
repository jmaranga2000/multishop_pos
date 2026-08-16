import { endOfDay, startOfDay, subDays } from "date-fns";
import { db } from "@/lib/db";

type Filters = { shopId?: string; from?: Date; to?: Date };

type PaymentBreakdown = Record<"CASH" | "MPESA" | "CARD" | "BANK_TRANSFER" | "MIXED", number>;

function emptyPayments(): PaymentBreakdown { return { CASH: 0, MPESA: 0, CARD: 0, BANK_TRANSFER: 0, MIXED: 0 }; }

function isTrackedPaymentMethod(value: unknown): value is keyof PaymentBreakdown {
  return value === "CASH" || value === "MPESA" || value === "CARD" || value === "BANK_TRANSFER" || value === "MIXED";
}

function reviewStatus(input: { netSales: number; refunds: number; discounts: number; voids: number; registerVariance: number }) {
  const refundRate = input.netSales > 0 ? input.refunds / input.netSales : 0;
  const discountRate = input.netSales > 0 ? input.discounts / input.netSales : 0;
  const absoluteVariance = Math.abs(input.registerVariance);
  if (absoluteVariance >= 1_000 || refundRate >= 0.05 || discountRate >= 0.1 || input.voids >= 3) return "REVIEW_REQUIRED" as const;
  if (absoluteVariance >= 300 || refundRate >= 0.025 || discountRate >= 0.05 || input.voids >= 1) return "ATTENTION" as const;
  return "NORMAL" as const;
}

export async function getEmployeePerformanceData(businessId: string, filters: Filters = {}) {
  const from = startOfDay(filters.from ?? subDays(new Date(), 29));
  const to = endOfDay(filters.to ?? new Date());
  const shopScope = filters.shopId ? { shopId: filters.shopId } : {};
  const [business, shops, employees, sales, sessions, refundRequests] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: businessId } }),
    db.shop.findMany({ where: { businessId, isActive: true }, orderBy: { name: "asc" } }),
    db.salespersonProfile.findMany({ where: { shop: { businessId }, ...shopScope }, include: { shop: true }, orderBy: { name: "asc" } }),
    db.sale.findMany({ where: { shop: { businessId }, ...shopScope, occurredAt: { gte: from, lte: to } }, include: { shop: true, salesperson: true, payments: true }, orderBy: { occurredAt: "desc" }, take: 5_000 }),
    db.registerSession.findMany({ where: { shop: { businessId }, ...shopScope, openedAt: { gte: from, lte: to } }, include: { shop: true, salesperson: true, register: true }, orderBy: { openedAt: "desc" }, take: 3_000 }),
    db.refundRequest.findMany({ where: { shop: { businessId }, ...shopScope, requestedAt: { gte: from, lte: to } }, include: { shop: true, sale: { include: { salesperson: true } } }, orderBy: { requestedAt: "desc" }, take: 3_000 }),
  ]);
  const rows = new Map(employees.map((employee) => [employee.id, {
    employee, salesTotal: 0, transactionCount: 0, completedSales: 0, voidCount: 0, discounts: 0, refunds: 0, refundCount: 0, payments: emptyPayments(), registerVariance: 0, registerSessions: 0,
  }]));
  const unassigned = { employee: { id: "unassigned", name: "Unassigned cashier", code: "-", shop: null }, salesTotal: 0, transactionCount: 0, completedSales: 0, voidCount: 0, discounts: 0, refunds: 0, refundCount: 0, payments: emptyPayments(), registerVariance: 0, registerSessions: 0 };
  for (const sale of sales) {
    const row = sale.salespersonId ? rows.get(sale.salespersonId) : undefined;
    const target = row ?? unassigned;
    if (sale.status === "COMPLETED" || sale.status === "REFUNDED") {
      target.transactionCount += 1; target.completedSales += sale.status === "COMPLETED" ? 1 : 0; target.salesTotal += Number(sale.total); target.discounts += Number(sale.discountTotal);
      for (const payment of sale.payments) {
        const method: unknown = payment.method;
        if (payment.status !== "FAILED" && isTrackedPaymentMethod(method)) target.payments[method] += Number(payment.amount);
      }
    }
    if (sale.status === "VOIDED") target.voidCount += 1;
  }
  for (const session of sessions) {
    const target = session.salespersonId ? rows.get(session.salespersonId) : undefined;
    if (!target) continue;
    target.registerSessions += 1; target.registerVariance += Number(session.variance ?? 0) + Number(session.mpesaVariance ?? 0);
  }
  for (const request of refundRequests) {
    const salespersonId = request.sale?.salespersonId;
    const target = salespersonId ? rows.get(salespersonId) : undefined;
    if (!target || request.status !== "COMPLETED") continue;
    target.refundCount += 1; target.refunds += Number(request.sale?.total ?? 0);
  }
  const performance = [...rows.values(), ...(unassigned.transactionCount || unassigned.voidCount ? [unassigned] : [])].map((row) => {
    const netSales = Math.max(0, row.salesTotal - row.refunds);
    return { ...row, netSales, averageTransaction: row.transactionCount ? row.salesTotal / row.transactionCount : 0, attention: reviewStatus({ netSales, refunds: row.refunds, discounts: row.discounts, voids: row.voidCount, registerVariance: row.registerVariance }) };
  }).sort((left, right) => right.netSales - left.netSales);
  const timeline = [
    ...sales.filter((sale) => sale.salespersonId).slice(0, 250).map((sale) => ({ id: `sale-${sale.id}`, at: sale.occurredAt, employeeId: sale.salespersonId!, employeeName: sale.salesperson?.name ?? "Unknown cashier", shopName: sale.shop?.name ?? "Shop", action: sale.status === "VOIDED" ? "Sale voided" : "Sale completed", detail: `${sale.receiptNumber} · ${sale.total.toFixed(2)}`, status: sale.status })),
    ...sessions.filter((session) => session.salespersonId).slice(0, 250).map((session) => ({ id: `session-${session.id}`, at: session.closedAt ?? session.openedAt, employeeId: session.salespersonId!, employeeName: session.salesperson?.name ?? "Unknown cashier", shopName: session.shop?.name ?? "Shop", action: session.status === "CLOSED" ? "Register closed" : "Register opened", detail: session.variance === null || session.variance === undefined ? "No cash variance yet" : `Variance ${Number(session.variance).toFixed(2)}`, status: session.status })),
    ...refundRequests.filter((request) => request.sale?.salespersonId).slice(0, 250).map((request) => ({ id: `refund-${request.id}`, at: request.requestedAt, employeeId: request.sale?.salespersonId!, employeeName: request.sale?.salesperson?.name ?? "Unknown cashier", shopName: request.shop?.name ?? "Shop", action: "Refund request", detail: request.reason, status: request.status })),
  ].sort((left, right) => right.at.getTime() - left.at.getTime()).slice(0, 300);
  return { business, shops, performance, timeline, from, to };
}