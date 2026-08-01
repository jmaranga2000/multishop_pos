import { z } from "zod";

const optionalText = z.string().trim().optional().default("");
const checkboxSchema = z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean());

export const businessSettingsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: optionalText.refine((value) => !value || z.string().email().safeParse(value).success, "Enter a valid email address"),
  phone: optionalText,
  address: optionalText,
  taxPin: optionalText,
  currency: z.string().trim().min(3).max(3).transform((value) => value.toUpperCase()),
  timezone: z.string().trim().min(3).max(80),
  receiptFooter: optionalText,
  defaultReorderLevel: z.coerce.number().int().min(0).max(1_000_000),
  defaultCriticalLevel: z.coerce.number().int().min(0).max(1_000_000),
  offlineSessionHours: z.coerce.number().int().min(1).max(168),
  syncIntervalMinutes: z.coerce.number().int().min(1).max(1440),
  weeklyReportDay: z.coerce.number().int().min(0).max(6),
  weeklyReportHour: z.coerce.number().int().min(0).max(23),
  posBarcodeScanningEnabled: checkboxSchema,
}).refine((data) => data.defaultCriticalLevel <= data.defaultReorderLevel, {
  message: "Critical level must not exceed the reorder level.",
  path: ["defaultCriticalLevel"],
});

export const notificationPreferencesSchema = z.object({
  lowStockInApp: checkboxSchema,
  lowStockPush: checkboxSchema,
  lowStockEmail: checkboxSchema,
  criticalInApp: checkboxSchema,
  criticalPush: checkboxSchema,
  criticalEmail: checkboxSchema,
  outOfStockInApp: checkboxSchema,
  outOfStockPush: checkboxSchema,
  outOfStockEmail: checkboxSchema,
  weeklyReportInApp: checkboxSchema,
  weeklyReportPush: checkboxSchema,
  weeklyReportEmail: checkboxSchema,
});
