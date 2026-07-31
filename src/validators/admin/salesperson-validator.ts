import { z } from "zod";

export const createSalespersonSchema = z.object({
  shopId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(30).transform((value) => value.toUpperCase()),
  pin: z.string().regex(/^\d{4,6}$/, "PIN must contain 4 to 6 digits."),
});

export const updateSalespersonSchema = z.object({
  salespersonId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(30).transform((value) => value.toUpperCase()),
  pin: z.string().regex(/^\d{4,6}$/, "PIN must contain 4 to 6 digits.").optional(),
});

export const toggleSalespersonSchema = z.object({ salespersonId: z.string().min(1), isActive: z.enum(["true", "false"]) });
