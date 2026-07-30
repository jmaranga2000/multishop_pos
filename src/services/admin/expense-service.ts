import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { writeAuditLog } from "@/services/shared/audit-service";
import type { z } from "zod";
import type { reviewExpenseSchema } from "@/validators/admin/review-validator";

type ReviewExpenseInput = z.infer<typeof reviewExpenseSchema>;

export async function getAdminExpensePageData(businessId: string) {
  const [business, expenses] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: businessId } }),
    db.expense.findMany({
      where: { shop: { businessId } },
      include: { shop: true, category: true },
      orderBy: { occurredAt: "desc" },
      take: 200,
    }),
  ]);
  return { business, expenses };
}

export async function reviewExpense(admin: { id: string; businessId: string }, input: ReviewExpenseInput) {
  const expense = await db.expense.findFirst({ where: { id: input.expenseId, shop: { businessId: admin.businessId } }, include: { shop: true } });
  if (!expense) throw new AppError("Expense was not found.", "EXPENSE_NOT_FOUND", 404);
  if (expense.status !== "PENDING") throw new AppError("This expense has already been reviewed.");
  const updated = await db.expense.update({ where: { id: expense.id }, data: { status: input.decision } });
  await writeAuditLog(db, {
    userId: admin.id,
    shopId: expense.shopId,
    action: input.decision === "APPROVED" ? "EXPENSE_APPROVED" : "EXPENSE_REJECTED",
    entityType: "EXPENSE",
    entityId: expense.id,
    description: `${input.decision === "APPROVED" ? "Approved" : "Rejected"} expense from ${expense.shop.name}.`,
  });
  return updated;
}
