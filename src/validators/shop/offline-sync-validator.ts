import { z } from "zod";

export const offlineSyncItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  sku: z.string().min(1),
  unitId: z.string().optional().nullable(),
  unitName: z.string().optional().nullable(),
  unitSymbol: z.string().optional().nullable(),
  quantity: z.number().int().positive(),
  unitPriceMinor: z.number().int().nonnegative(),
  unitCostMinor: z.number().int().nonnegative(),
  lineTotalMinor: z.number().int().nonnegative(),
});

export const offlineSyncSaleSchema = z.object({
  queueId: z.string().min(1),
  sale: z.object({
    localId: z.string().uuid(),
    idempotencyKey: z.string().min(10),
    shopId: z.string().min(1),
    deviceId: z.string().min(1),
    salespersonId: z.string().nullable(),
    registerSessionId: z.string().nullable(),
    customerName: z.string().nullable(),
    subtotalMinor: z.number().int().nonnegative(),
    discountMinor: z.number().int().nonnegative(),
    taxMinor: z.number().int().nonnegative(),
    totalMinor: z.number().int().positive(),
    amountPaidMinor: z.number().int().nonnegative(),
    changeDueMinor: z.number().int().nonnegative(),
    paymentMethod: z.enum(["CASH", "MPESA", "CARD", "BANK_TRANSFER"]),
    paymentReference: z.string().nullable(),
    occurredAt: z.string().datetime(),
  }),
  items: z.array(offlineSyncItemSchema).min(1),
});

export const offlineSyncPayloadSchema = z.object({
  deviceId: z.string().min(1),
  sales: z.array(offlineSyncSaleSchema).max(100),
});
