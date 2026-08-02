import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { writeAuditLog } from "@/services/shared/audit-service";
import type { z } from "zod";
import type { createExpenseSchema } from "@/validators/shop/expense-validator";

type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
type ShopContext = { id: string; shopId: string; businessId: string };

export async function getShopExpenseData(shopId: string, businessId: string) {
  const [business, categories, expenses] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: businessId } }),
    db.expenseCategory.findMany({ where: { businessId, isActive: true }, orderBy: { name: "asc" } }),
    db.expense.findMany({ where: { shopId }, include: { category: true }, orderBy: { occurredAt: "desc" }, take: 100 }),
  ]);
  return { business, categories, expenses };
}

export async function createShopExpense(shopUser: ShopContext, input: CreateExpenseInput) {
  const category = await db.expenseCategory.findFirst({ where: { id: input.categoryId, businessId: shopUser.businessId, isActive: true } });
  if (!category) throw new AppError("Expense category was not found.");
  const expense = await db.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: {
        shopId: shopUser.shopId,
        categoryId: category.id,
        source: input.source,
        amount: input.amount,
        description: input.description,
        occurredAt: input.occurredAt,
      },
    });
    const admin = await tx.user.findFirst({ where: { businessId: shopUser.businessId, role: "ADMIN", status: "ACTIVE" } });
    if (admin) {
      await tx.notification.create({
        data: {
          userId: admin.id,
          shopId: shopUser.shopId,
          type: "SYSTEM",
          title: "Expense awaiting approval",
          message: `${category.name}: ${input.amount.toFixed(2)} requires review.`,
          actionUrl: "/admin/expenses",
        },
      });
    }
    await writeAuditLog(tx, {
      userId: shopUser.id,
      shopId: shopUser.shopId,
      action: "EXPENSE_SUBMITTED",
      entityType: "EXPENSE",
      entityId: created.id,
      description: `Submitted ${category.name} expense for approval.`,
    });
    return created;
  });
  return expense;
}
