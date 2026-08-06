import { createHash } from "crypto";
import { db as database } from "@/lib/db";
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

type EmailAttachment = {
  filename: string;
  contentType: string;
  content: string;
};

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
  email?: { to: string; subject?: string; html?: string; attachments?: Array<{ filename: string; contentType: string; content: string }> };
  push?: boolean;
  inApp?: boolean;
};

type StatusTone = "green" | "amber" | "red" | "slate";

type SnapshotRow = {
  label: string;
  value: string;
  description?: string;
  tone?: StatusTone;
};

export function buildSnapshotHtml(title: string, rows: SnapshotRow[], subtitle?: string) {
  const palette: Record<StatusTone, string> = {
    green: "#dcfce7",
    amber: "#fef3c7",
    red: "#fee2e2",
    slate: "#e2e8f0",
  };
  const cells = rows.map((row) => {
    const tone = row.tone ?? "slate";
    const value = escapeHtml(row.value);
    const description = row.description ? `<div style="font-size:12px;color:#475569;margin-top:4px;">${escapeHtml(row.description)}</div>` : "";
    return `
      <div style="flex:1;min-width:160px;border-radius:14px;padding:12px;background:${palette[tone]};border:1px solid rgba(15,23,42,0.06);">
        <div style="font-size:11px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.06em;">${escapeHtml(row.label)}</div>
        <div style="margin-top:6px;font-size:20px;font-weight:800;color:#0f172a;">${value}</div>
        ${description}
      </div>
    `;
  }).join("");

  const subtitleHtml = subtitle ? `<div style="font-size:12px;color:#475569;margin:8px 0 14px;">${escapeHtml(subtitle)}</div>` : "";

  return `
    <div style="font-family:Arial,sans-serif;max-width:720px;padding:24px;border-radius:20px;border:1px solid #e2e8f0;background:#ffffff;color:#0f172a;">
      <div style="font-size:22px;font-weight:800;margin-bottom:8px;">${escapeHtml(title)}</div>
      ${subtitleHtml}
      <div style="display:flex;flex-wrap:wrap;gap:12px;">${cells}</div>
    </div>
  `;
}

export function buildStockAlertHtml(rows: SnapshotRow[]) {
  return buildSnapshotHtml("Stock status snapshot", rows, "Immediate stock attention requires review by the administrator.");
}

export function buildShopPerformanceHtml(rows: SnapshotRow[]) {
  return buildSnapshotHtml("Daily shop performance", rows, "Sales snapshot for all active shops at 9:00 PM Kenya time.");
}

export async function queueNotification(input: QueueNotificationInput) {
  const db = input.tx ?? database;
  const shouldSendInApp = input.inApp ?? true;

  if (shouldSendInApp) {
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
  }

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
        attachments: input.email.attachments,
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
