import { z } from "zod";

const checkbox = z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean());

export const taxSettingsSchema = z.object({
  vatEnabled: checkbox,
  standardVatRate: z.coerce.number().min(0).max(100),
  priceTaxMode: z.enum(["VAT_EXCLUSIVE", "VAT_INCLUSIVE"]),
  allowShopEtimsCheckout: checkbox,
});

export const etimsConfigurationSchema = z.object({
  shopId: z.string().min(1),
  enabled: checkbox,
  integrationMode: z.enum(["OSCU", "VSCU"]),
  taxpayerPin: z.string().trim().max(32).optional().transform((value) => value || null),
  branchCode: z.string().trim().max(64).optional().transform((value) => value || null),
  deviceId: z.string().trim().max(128).optional().transform((value) => value || null),
  credentialReference: z.string().trim().max(160).optional().transform((value) => value || null),
});