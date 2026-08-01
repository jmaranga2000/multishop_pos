import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { writeAuditLog } from "@/services/shared/audit-service";
import type { z } from "zod";
import type { reviewExpenseSchema } from "@/validators/admin/review-validator";
import type { createExpenseCategorySchema, updateExpenseCategorySchema } from "@/validators/admin/expense-validator";

type ReviewExpenseInput = z.infer<typeof reviewExpenseSchema>;
type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;
type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>;

export async function getAdminExpensePageData(businessId: string) {
  const [business, categories, expenses] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: businessId } }),
    db.expenseCategory.findMany({ where: { businessId }, orderBy: { name: "asc" } }),
    db.expense.findMany({
      where: { shop: { businessId } },
      include: { shop: true, category: true },
      orderBy: { occurredAt: "desc" },
      take: 200,
    }),
  ]);
  return { business, categories, expenses };
}

export async function getExpenseCategoryById(businessId: string, categoryId: string) {
  return db.expenseCategory.findFirst({
    where: { id: categoryId, businessId },
    include: {
      business: { select: { currency: true } },
      expenses: {
        orderBy: { occurredAt: "desc" },
        take: 20,
        include: { shop: true },
      },
    },
  });
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

export async function createExpenseCategory(admin: { businessId: string }, input: CreateExpenseCategoryInput) {
  const existing = await db.expenseCategory.findFirst({ where: { businessId: admin.businessId, name: input.name, isActive: true } });
  if (existing) throw new AppError("An active expense category with this name already exists.");

  return db.expenseCategory.create({
    data: {
      businessId: admin.businessId,
      name: input.name,
      isActive: true,
    },
  });
}

export async function updateExpenseCategory(admin: { businessId: string }, input: UpdateExpenseCategoryInput) {
  const category = await db.expenseCategory.findFirst({ where: { id: input.id, businessId: admin.businessId } });
  if (!category) throw new AppError("Expense category was not found.", "EXPENSE_CATEGORY_NOT_FOUND", 404);

  return db.expenseCategory.update({
    where: { id: input.id },
    data: { name: input.name },
  });
}

export async function toggleExpenseCategoryActive(admin: { businessId: string }, input: { id: string; isActive: boolean }) {
  const category = await db.expenseCategory.findFirst({ where: { id: input.id, businessId: admin.businessId } });
  if (!category) throw new AppError("Expense category was not found.", "EXPENSE_CATEGORY_NOT_FOUND", 404);

  return db.expenseCategory.update({ where: { id: input.id }, data: { isActive: input.isActive } });
}
