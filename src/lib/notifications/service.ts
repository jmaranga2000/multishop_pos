import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/utils";

type Tx = any;

type InventoryAlertType = "LOW_STOCK" | "CRITICAL_STOCK" | "OUT_OF_STOCK";
 type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
 type NotificationType =
  | "LOW_STOCK"
  | "CRITICAL_STOCK"
  | "OUT_OF_STOCK"
  | "WEEKLY_REPORT"
  | "REFUND_REQUEST"
  | "REGISTER_DISCREPANCY"
  | "SYNC_CONFLICT"
  | "STOCK_TRANSFER"
  | "SYSTEM";

type QueueNotificationInput = {
  tx?: Tx;
  businessId: string;
  userId: string;
  shopId?: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  actionUrl?: string;
  email?: { to: string; subject?: string; html?: string };
  push?: boolean;
};

export async function queueNotification(input: QueueNotificationInput) {
  const db = input.tx ?? prisma;
  await db.notification.create({
    data: {
      userId: input.userId,
      shopId: input.shopId,
      type: input.type,
      priority: input.priority ?? "NORMAL",
      title: input.title,
      message: input.message,
      actionUrl: input.actionUrl,
    },
  });

  if (input.push) {
    await db.pushNotificationQueue.create({
      data: {
        userId: input.userId,
        title: input.title,
        body: input.message,
        actionUrl: input.actionUrl,
        tag: input.type.toLowerCase(),
      },
    });
  }

  if (input.email) {
    await db.emailQueue.create({
      data: {
        recipient: input.email.to,
        subject: input.email.subject ?? input.title,
        htmlBody: input.email.html ?? `<h2>${escapeHtml(input.title)}</h2><p>${escapeHtml(input.message)}</p><p><a href="${absoluteUrl(input.actionUrl ?? "/admin/notifications")}">Open MultiShop POS</a></p>`,
        textBody: `${input.title}\n\n${input.message}`,
        type: input.type,
      },
    });
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char] ?? char));
}

export function hashEndpoint(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}

export function alertNotificationType(type: InventoryAlertType): NotificationType {
  return type === "LOW_STOCK" ? "LOW_STOCK" : type === "CRITICAL_STOCK" ? "CRITICAL_STOCK" : "OUT_OF_STOCK";
}
