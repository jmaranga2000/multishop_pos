import { z } from "zod";

const optionalText = z.string().trim().optional().default("");

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
}).refine((data) => data.defaultCriticalLevel <= data.defaultReorderLevel, {
  message: "Critical level must not exceed the reorder level.",
  path: ["defaultCriticalLevel"],
});

const checkbox = z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean());

export const notificationPreferencesSchema = z.object({
  lowStockInApp: checkbox,
  lowStockPush: checkbox,
  lowStockEmail: checkbox,
  criticalInApp: checkbox,
  criticalPush: checkbox,
  criticalEmail: checkbox,
  outOfStockInApp: checkbox,
  outOfStockPush: checkbox,
  outOfStockEmail: checkbox,
  weeklyReportInApp: checkbox,
  weeklyReportPush: checkbox,
  weeklyReportEmail: checkbox,
});
