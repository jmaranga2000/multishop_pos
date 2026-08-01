import { getStockStatus } from "@/lib/utils";
import { alertNotificationType, buildStockAlertHtml, queueNotification } from "@/lib/notifications/service";

type Tx = any;
type InventoryAlertType = "LOW_STOCK" | "CRITICAL_STOCK" | "OUT_OF_STOCK";

export async function reconcileStockAlert(tx: Tx, input: {
  businessId: string;
  shopId: string;
  shopName: string;
  productId: string;
  productName: string;
  quantity: number;
  reorderLevel: number;
  criticalLevel: number;
  adminId: string;
  adminEmail?: string | null;
}) {
  const status = getStockStatus(input.quantity, input.reorderLevel, input.criticalLevel);
  const active = await tx.inventoryAlert.findFirst({
    where: { shopId: input.shopId, productId: input.productId, status: { in: ["ACTIVE", "ACKNOWLEDGED"] } },
    orderBy: { lastTriggeredAt: "desc" },
  });

  if (status === "IN_STOCK") {
    if (active) await tx.inventoryAlert.update({ where: { id: active.id }, data: { status: "RESOLVED", resolvedAt: new Date() } });
    return;
  }

  const type: InventoryAlertType = status === "LOW_STOCK" ? "LOW_STOCK" : status === "CRITICAL" ? "CRITICAL_STOCK" : "OUT_OF_STOCK";
  const threshold = type === "LOW_STOCK" ? input.reorderLevel : type === "CRITICAL_STOCK" ? input.criticalLevel : 0;
  let shouldNotify = false;

  if (!active) {
    await tx.inventoryAlert.create({ data: { shopId: input.shopId, productId: input.productId, type, currentQuantity: input.quantity, thresholdQuantity: threshold } });
    shouldNotify = true;
  } else {
    const upgraded = active.type !== type;
    await tx.inventoryAlert.update({ where: { id: active.id }, data: { type, status: "ACTIVE", currentQuantity: input.quantity, thresholdQuantity: threshold, lastTriggeredAt: new Date(), resolvedAt: null } });
    shouldNotify = upgraded;
  }

  if (!shouldNotify) return;

  const preferences = await tx.notificationPreference.findUnique({ where: { businessId: input.businessId } });
  const inAppEnabled = type === "LOW_STOCK" ? preferences?.lowStockInApp ?? true : type === "CRITICAL_STOCK" ? preferences?.criticalInApp ?? true : preferences?.outOfStockInApp ?? true;
  const pushEnabled = type === "LOW_STOCK" ? preferences?.lowStockPush ?? true : type === "CRITICAL_STOCK" ? preferences?.criticalPush ?? true : preferences?.outOfStockPush ?? true;
  const emailEnabled = type === "LOW_STOCK" ? preferences?.lowStockEmail ?? false : type === "CRITICAL_STOCK" ? preferences?.criticalEmail ?? true : preferences?.outOfStockEmail ?? true;
  const label = type === "LOW_STOCK" ? "Low stock" : type === "CRITICAL_STOCK" ? "Critical stock" : "Out of stock";
  const tone = type === "LOW_STOCK" ? "amber" : type === "CRITICAL_STOCK" ? "red" : "red";
  const message = `${input.productName} at ${input.shopName} has ${input.quantity} unit${input.quantity === 1 ? "" : "s"} remaining.`;

  const html = buildStockAlertHtml([
    { label: "Shop", value: input.shopName, tone: "slate" },
    { label: "Product", value: input.productName, tone: "slate" },
    { label: "Status", value: label, tone },
    { label: "Remaining", value: `${input.quantity} units`, tone: input.quantity > 0 ? "amber" : "red" },
  ]);

  if (!inAppEnabled) return;

  await queueNotification({
    tx,
    businessId: input.businessId,
    userId: input.adminId,
    shopId: input.shopId,
    type: alertNotificationType(type),
    priority: type === "OUT_OF_STOCK" ? "URGENT" : type === "CRITICAL_STOCK" ? "HIGH" : "NORMAL",
    title: `${label}: ${input.productName}`,
    message,
    actionUrl: `/admin/inventory?shop=${input.shopId}&product=${input.productId}`,
    push: pushEnabled,
    email: emailEnabled && input.adminEmail ? { to: input.adminEmail, subject: `${label}: ${input.productName}`, html } : undefined,
  });
}
