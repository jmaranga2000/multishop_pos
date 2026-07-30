import { defineModel, index, now } from "./model-definition";
import type {
  EmailQueueDocument,
  NotificationDocument,
  NotificationPreferenceDocument,
  PushNotificationQueueDocument,
  PushSubscriptionDocument,
} from "./model.types";

const queueStatuses = ["PENDING", "PROCESSING", "SENT", "FAILED"] as const;

export const NotificationModel = defineModel<NotificationDocument>({
  collection: "notifications",
  required: ["type", "title", "message"],
  defaults: { priority: "NORMAL", isRead: false, createdAt: now },
  enums: {
    type: [
      "LOW_STOCK", "CRITICAL_STOCK", "OUT_OF_STOCK", "WEEKLY_REPORT",
      "REFUND_REQUEST", "REGISTER_DISCREPANCY", "SYNC_CONFLICT",
      "STOCK_TRANSFER", "SYSTEM",
    ],
    priority: ["LOW", "NORMAL", "HIGH", "URGENT"],
  },
  indexes: [
    index({ userId: 1, isRead: 1, createdAt: -1 }),
    index({ shopId: 1, createdAt: -1 }),
  ],
  timestamps: false,
});

export const NotificationPreferenceModel = defineModel<NotificationPreferenceDocument>({
  collection: "notificationPreferences",
  required: ["businessId"],
  defaults: {
    lowStockInApp: true,
    lowStockPush: true,
    lowStockEmail: false,
    criticalInApp: true,
    criticalPush: true,
    criticalEmail: true,
    outOfStockInApp: true,
    outOfStockPush: true,
    outOfStockEmail: true,
    weeklyReportInApp: true,
    weeklyReportPush: true,
    weeklyReportEmail: true,
  },
  indexes: [index({ businessId: 1 }, { unique: true })],
  timestamps: "updated",
});

export const EmailQueueModel = defineModel<EmailQueueDocument>({
  collection: "emailQueue",
  required: ["recipient", "subject", "htmlBody", "type"],
  defaults: {
    status: "PENDING",
    attempts: 0,
    maximumAttempts: 3,
    scheduledFor: now,
    textBody: null,
  },
  enums: { status: queueStatuses },
  indexes: [index({ status: 1, scheduledFor: 1 })],
});

export const PushSubscriptionModel = defineModel<PushSubscriptionDocument>({
  collection: "pushSubscriptions",
  required: ["userId", "endpointHash", "endpoint", "p256dh", "auth"],
  defaults: { isActive: true, failureCount: 0 },
  indexes: [
    index({ endpointHash: 1 }, { unique: true }),
    index({ userId: 1, isActive: 1 }),
  ],
});

export const PushNotificationQueueModel = defineModel<PushNotificationQueueDocument>({
  collection: "pushNotificationQueue",
  required: ["userId", "title", "body"],
  defaults: { status: "PENDING", attempts: 0, maximumAttempts: 3, scheduledFor: now },
  enums: { status: queueStatuses },
  indexes: [index({ status: 1, scheduledFor: 1 }), index({ userId: 1 })],
});

export const notificationModels = {
  notification: NotificationModel,
  notificationPreference: NotificationPreferenceModel,
  emailQueue: EmailQueueModel,
  pushSubscription: PushSubscriptionModel,
  pushNotificationQueue: PushNotificationQueueModel,
};
