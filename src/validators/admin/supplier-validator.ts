import { z } from "zod";

export const supplierStatusSchema = z.enum(["ACTIVE", "DISABLED"]);

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1),
  company: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().min(1),
  alternativePhone: z.string().trim().optional().nullable(),
  shopId: z.string().trim().min(1),
  address: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  status: supplierStatusSchema,
});

export const updateSupplierSchema = createSupplierSchema.extend({
  supplierId: z.string().trim().min(1),
});

export const supplierProductAssignmentSchema = z.object({
  supplierId: z.string().trim().min(1),
  productIds: z.array(z.string().trim().min(1)).optional(),
  targetQuantities: z.record(z.string().trim().min(1), z.coerce.number().int().min(0)).optional(),
});

export const supplierNotificationFilterSchema = z.object({
  shopId: z.string().trim().optional(),
  supplierId: z.string().trim().optional(),
  status: z.enum(["PENDING", "SENT", "FAILED"]).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});
