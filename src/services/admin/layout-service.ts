import { db } from "@/lib/db";

export async function getUnreadNotificationCount(userId: string) {
  return db.notification.count({ where: { userId, isRead: false } });
}
