import { db } from "@/lib/db";
import { sendQueuedEmail } from "@/lib/mailer";
import { sendWebPush } from "@/lib/push";

export async function processNotificationQueues() {
  let emailSent = 0;
  let pushSent = 0;
  let failed = 0;

  const emails = await db.emailQueue.findMany({
    where: { status: { in: ["PENDING", "FAILED"] }, scheduledFor: { lte: new Date() }, attempts: { lt: 3 } },
    take: 25,
  });

  for (const email of emails) {
    await db.emailQueue.update({ where: { id: email.id }, data: { status: "PROCESSING", attempts: { increment: 1 } } });
    try {
      await sendQueuedEmail(email);
      await db.emailQueue.update({ where: { id: email.id }, data: { status: "SENT", sentAt: new Date(), lastError: null } });
      emailSent += 1;
    } catch (error) {
      failed += 1;
      await db.emailQueue.update({
        where: { id: email.id },
        data: {
          status: "FAILED",
          lastError: error instanceof Error ? error.message : "Email failed",
          scheduledFor: new Date(Date.now() + 5 * 60_000),
        },
      });
    }
  }

  const pushes = await db.pushNotificationQueue.findMany({
    where: { status: { in: ["PENDING", "FAILED"] }, scheduledFor: { lte: new Date() }, attempts: { lt: 3 } },
    take: 25,
  });

  for (const push of pushes) {
    await db.pushNotificationQueue.update({ where: { id: push.id }, data: { status: "PROCESSING", attempts: { increment: 1 } } });
    try {
      const subscriptions = await db.pushSubscription.findMany({ where: { userId: push.userId, isActive: true } });
      for (const subscription of subscriptions) {
        try {
          await sendWebPush(subscription, { title: push.title, body: push.body, actionUrl: push.actionUrl, tag: push.tag });
          await db.pushSubscription.update({ where: { id: subscription.id }, data: { lastUsedAt: new Date(), failureCount: 0 } });
        } catch (error: unknown) {
          const statusCode = typeof error === "object" && error && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : 0;
          if (statusCode === 404 || statusCode === 410) {
            await db.pushSubscription.update({ where: { id: subscription.id }, data: { isActive: false } });
          } else {
            await db.pushSubscription.update({ where: { id: subscription.id }, data: { failureCount: { increment: 1 } } });
          }
        }
      }
      await db.pushNotificationQueue.update({ where: { id: push.id }, data: { status: "SENT", sentAt: new Date(), lastError: null } });
      pushSent += 1;
    } catch (error) {
      failed += 1;
      await db.pushNotificationQueue.update({
        where: { id: push.id },
        data: {
          status: "FAILED",
          lastError: error instanceof Error ? error.message : "Push failed",
          scheduledFor: new Date(Date.now() + 5 * 60_000),
        },
      });
    }
  }

  return { emailSent, pushSent, failed };
}
