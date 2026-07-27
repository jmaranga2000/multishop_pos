import { getStockStatus } from "@/lib/utils";
import { alertNotificationType, queueNotification } from "@/lib/notifications/service";

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
  const label = type === "LOW_STOCK" ? "Low stock" : type === "CRITICAL_STOCK" ? "Critical stock" : "Out of stock";
  const message = `${input.productName} at ${input.shopName} has ${input.quantity} unit${input.quantity === 1 ? "" : "s"} remaining.`;
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
    push: true,
    email: type === "LOW_STOCK" || !input.adminEmail ? undefined : { to: input.adminEmail },
  });
}
