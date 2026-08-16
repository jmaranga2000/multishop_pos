import { db } from "@/lib/db";
import { getTaxSettings } from "@/services/etims/etims-service";
import { writeAuditLog } from "@/services/shared/audit-service";

export async function getAdminEtimsSettingsData(businessId: string) {
  const [taxSettings, shops, configurations] = await Promise.all([
    getTaxSettings(businessId),
    db.shop.findMany({ where: { businessId }, orderBy: { name: "asc" } }),
    db.etimsConfiguration.findMany({ where: { businessId } }),
  ]);
  return { taxSettings, shops, configurations };
}

export async function updateTaxSettings(
  admin: { id: string; businessId: string },
  input: { vatEnabled: boolean; standardVatRate: number; priceTaxMode: "VAT_EXCLUSIVE" | "VAT_INCLUSIVE"; allowShopEtimsCheckout: boolean },
) {
  return db.$transaction(async (tx) => {
    const settings = await tx.taxSettings.upsert({
      where: { businessId: admin.businessId },
      create: { businessId: admin.businessId, ...input },
      update: input,
    });
    await writeAuditLog(tx, {
      userId: admin.id,
      action: "VAT_SETTINGS_UPDATED",
      entityType: "TAX_SETTINGS",
      entityId: settings.id,
      description: "Updated business VAT and eTIMS checkout permissions.",
      metadata: { vatEnabled: input.vatEnabled, standardVatRate: input.standardVatRate, priceTaxMode: input.priceTaxMode },
    });
    return settings;
  });
}

export async function updateEtimsConfiguration(
  admin: { id: string; businessId: string },
  input: { shopId: string; enabled: boolean; integrationMode: "OSCU" | "VSCU"; taxpayerPin: string | null; branchCode: string | null; deviceId: string | null; credentialReference: string | null },
) {
  const shop = await db.shop.findFirst({ where: { id: input.shopId, businessId: admin.businessId } });
  if (!shop) throw new Error("Shop not found.");
  return db.$transaction(async (tx) => {
    const configuration = await tx.etimsConfiguration.upsert({
      where: { shopId: input.shopId },
      create: { businessId: admin.businessId, ...input },
      update: {
        enabled: input.enabled,
        integrationMode: input.integrationMode,
        taxpayerPin: input.taxpayerPin,
        branchCode: input.branchCode,
        deviceId: input.deviceId,
        credentialReference: input.credentialReference,
      },
    });
    await writeAuditLog(tx, {
      userId: admin.id,
      shopId: input.shopId,
      action: "ETIMS_CONFIGURATION_UPDATED",
      entityType: "ETIMS_CONFIGURATION",
      entityId: configuration.id,
      description: `Updated eTIMS configuration for ${shop.name}.`,
      metadata: { enabled: input.enabled, integrationMode: input.integrationMode, credentialReference: input.credentialReference },
    });
    return configuration;
  });
}