import { prisma } from "@/lib/prisma";
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
    prisma.business.findUniqueOrThrow({ where: { id: input.businessId }, select: { offlineSessionHours: true } }),
    prisma.shopInventory.findMany({
      where: { shopId: input.shopId, product: { status: "ACTIVE" } },
      include: { product: { include: { category: true } } },
      orderBy: { product: { name: "asc" } },
    }),
  ]);

  const now = new Date();
  const offlineAccessExpiresAt = new Date(now.getTime() + business.offlineSessionHours * 60 * 60 * 1000);
  await prisma.offlineDevice.upsert({
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
