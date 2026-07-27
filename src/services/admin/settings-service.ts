import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/services/shared/audit-service";

export async function getAdminSettingsData(businessId: string) {
  return prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    include: { notificationPreference: true },
  });
}

export async function updateBusinessSettings(
  admin: { id: string; businessId: string },
  input: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    taxPin?: string;
    currency: string;
    timezone: string;
    receiptFooter?: string;
    defaultReorderLevel: number;
    defaultCriticalLevel: number;
    offlineSessionHours: number;
    syncIntervalMinutes: number;
    weeklyReportDay: number;
    weeklyReportHour: number;
  },
) {
  return prisma.$transaction(async (tx) => {
    const business = await tx.business.update({
      where: { id: admin.businessId },
      data: {
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        address: input.address || null,
        taxPin: input.taxPin || null,
        currency: input.currency,
        timezone: input.timezone,
        receiptFooter: input.receiptFooter || null,
        defaultReorderLevel: input.defaultReorderLevel,
        defaultCriticalLevel: input.defaultCriticalLevel,
        offlineSessionHours: input.offlineSessionHours,
        syncIntervalMinutes: input.syncIntervalMinutes,
        weeklyReportDay: input.weeklyReportDay,
        weeklyReportHour: input.weeklyReportHour,
      },
    });
    await writeAuditLog(tx, {
      userId: admin.id,
      action: "BUSINESS_SETTINGS_UPDATED",
      entityType: "BUSINESS",
      entityId: admin.businessId,
      description: "Updated business, inventory, offline and reporting settings.",
    });
    return business;
  });
}

export async function updateNotificationPreferences(
  admin: { id: string; businessId: string },
  input: {
    lowStockInApp: boolean;
    lowStockPush: boolean;
    lowStockEmail: boolean;
    criticalInApp: boolean;
    criticalPush: boolean;
    criticalEmail: boolean;
    outOfStockInApp: boolean;
    outOfStockPush: boolean;
    outOfStockEmail: boolean;
    weeklyReportInApp: boolean;
    weeklyReportPush: boolean;
    weeklyReportEmail: boolean;
  },
) {
  return prisma.$transaction(async (tx) => {
    const preferences = await tx.notificationPreference.upsert({
      where: { businessId: admin.businessId },
      create: { businessId: admin.businessId, ...input },
      update: input,
    });
    await writeAuditLog(tx, {
      userId: admin.id,
      action: "NOTIFICATION_PREFERENCES_UPDATED",
      entityType: "NOTIFICATION_PREFERENCE",
      entityId: preferences.id,
      description: "Updated in-app, push and SMTP notification channel preferences.",
    });
    return preferences;
  });
}
