import { z } from "zod";

const refundMethodSchema = z.enum(["CASH", "MPESA", "CARD", "BANK_TRANSFER", "MIXED"]);
const requestTypeSchema = z.enum(["FULL_SALE", "SELECTED_PRODUCTS", "EXCHANGE"]);

const optionalString = z.preprocess((value) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  return value;
}, z.string().min(3).max(100).optional());

export const createRefundRequestSchema = z.object({
  saleId: z.preprocess((value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    }
    return value;
  }, z.string().min(1).optional()),
  receiptNumber: optionalString,
  requestType: requestTypeSchema.default("FULL_SALE"),
  refundMethod: refundMethodSchema.default("CASH"),
  selectedItemIds: z.array(z.string().trim().min(1)).default([]),
  restockReturnedProducts: z.boolean().default(true),
  markItemsAsDamaged: z.boolean().default(false),
  requestManagerApproval: z.boolean().default(false),
  reason: z.string().trim().min(5).max(1000),
}).refine((value) => Boolean(value.saleId || value.receiptNumber), {
  message: "Select a completed sale to refund.",
  path: ["saleId"],
}).refine((value) => value.requestType !== "SELECTED_PRODUCTS" || value.selectedItemIds.length > 0, {
  message: "Select at least one item to return.",
  path: ["selectedItemIds"],
});
