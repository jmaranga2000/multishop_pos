import { defineModel, index, now } from "./model-definition";
import type { ExpenseCategoryDocument, ExpenseDocument } from "./model.types";

export const ExpenseCategoryModel = defineModel<ExpenseCategoryDocument>({
  collection: "expenseCategories",
  required: ["businessId", "name"],
  defaults: { isActive: true, createdAt: now },
  indexes: [index({ businessId: 1, name: 1 }, { unique: true })],
  timestamps: false,
});

export const ExpenseModel = defineModel<ExpenseDocument>({
  collection: "expenses",
  required: ["shopId", "categoryId", "source", "amount", "description", "occurredAt"],
  defaults: { status: "PENDING", source: "CASH" },
  enums: { status: ["PENDING", "APPROVED", "REJECTED"], source: ["CASH", "MPESA"] },
  indexes: [index({ shopId: 1, status: 1, occurredAt: 1 })],
});

export const expenseModels = {
  expenseCategory: ExpenseCategoryModel,
  expense: ExpenseModel,
};
