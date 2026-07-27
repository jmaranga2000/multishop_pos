import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors/app-error";

export async function listAdminNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    include: { shop: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const notification = await prisma.notification.findFirst({ where: { id: notificationId, userId } });
  if (!notification) throw new AppError("Notification was not found.", "NOTIFICATION_NOT_FOUND", 404);
  return prisma.notification.update({
    where: { id: notification.id },
    data: { isRead: true, readAt: notification.readAt ?? new Date() },
  });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}
