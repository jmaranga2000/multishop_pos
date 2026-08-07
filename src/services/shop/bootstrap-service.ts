import { db } from "@/lib/db";
import { toMinorUnits } from "@/lib/utils";

export async function bootstrapShopDevice(input: {
  businessId: string;
  shopId: string;
  shopName: string;
  deviceId: string;
  deviceName?: string | null;
  platform?: string | null;
  userAgent?: string | null;
}) {
  const [business, inventory] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: input.businessId }, select: { offlineSessionHours: true } }),
    db.shopInventory.findMany({
      where: { shopId: input.shopId, product: { status: "ACTIVE" } },
      include: { product: { include: { category: true, unit: true, pricingUnits: { include: { unit: true } } } } },
      orderBy: { product: { name: "asc" } },
    }),
  ]);

  const now = new Date();
  const offlineAccessExpiresAt = new Date(now.getTime() + business.offlineSessionHours * 60 * 60 * 1000);
  await db.offlineDevice.upsert({
    where: { id: input.deviceId },
    update: {
      shopId: input.shopId,
      lastSeenAt: now,
      lastSyncAt: now,
      offlineAccessExpiresAt,
      isActive: true,
    },
    create: {
      id: input.deviceId,
      shopId: input.shopId,
      name: input.deviceName ?? "Shop device",
      platform: input.platform,
      userAgent: input.userAgent,
      lastSyncAt: now,
      offlineAccessExpiresAt,
    },
  });

  return {
    shopId: input.shopId,
    shopName: input.shopName,
    syncedAt: now.toISOString(),
    offlineAccessExpiresAt: offlineAccessExpiresAt.toISOString(),
    products: inventory.map((entry) => ({
      id: entry.product.id,
      name: entry.product.name,
      sku: entry.product.sku,
      barcode: entry.product.barcode,
      categoryName: entry.product.category?.name ?? null,
      imageUrl: entry.product.imageUrl,
      taxRate: Number(entry.product.taxRate ?? 0),
      unitId: entry.product.unitId ?? null,
      unitName: entry.product.unit?.name ?? null,
      unitSymbol: entry.product.unit?.symbol ?? null,
      pricingOptions: (entry.product.pricingUnits ?? []).map((pricing: { unitId: string; unit?: { name: string | null; symbol: string | null }; costPrice: number; sellingPrice: number }) => ({
        unitId: pricing.unitId,
        unitName: pricing.unit?.name ?? null,
        unitSymbol: pricing.unit?.symbol ?? null,
        costPriceMinor: toMinorUnits(pricing.costPrice.toString()),
        sellingPriceMinor: toMinorUnits(pricing.sellingPrice.toString()),
        multiplier: (pricing as any).multiplier ?? 1,
      })),
      status: entry.product.status,
    })),
    inventory: inventory.map((entry) => ({
      id: entry.id,
      shopId: entry.shopId,
      productId: entry.productId,
      serverQuantity: entry.quantity,
      projectedQuantity: entry.quantity,
      sellingPriceMinor: toMinorUnits(entry.sellingPrice.toString()),
      costPriceMinor: toMinorUnits(entry.costPrice.toString()),
      reorderLevel: entry.reorderLevel,
      criticalLevel: entry.criticalLevel,
      isAvailable: entry.isAvailable,
      version: entry.version,
      syncedAt: now.toISOString(),
    })),
  };
}
