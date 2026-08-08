import { db } from "@/lib/db";
import { sendQueuedEmail } from "@/lib/mailer";
import { sendWebPush } from "@/lib/push";

const MAX_ITEMS_PER_QUEUE_RUN = 25;
const MAX_CLAIM_ATTEMPTS = MAX_ITEMS_PER_QUEUE_RUN * 3;
const MAX_DELIVERY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5 * 60_000;
const STALE_PROCESSING_AFTER_MS = 10 * 60_000;

function isClaimRace(error: unknown) {
  return error instanceof Error && error.message.includes("record was not found for update");
}

async function recoverStalledQueueItems() {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_AFTER_MS);
  const data = {
    status: "FAILED",
    scheduledFor: now,
    lastError: "Delivery was interrupted before completion and has been re-queued.",
  } as const;

  const [emails, pushes] = await Promise.all([
    db.emailQueue.updateMany({ where: { status: "PROCESSING", updatedAt: { lt: staleBefore } }, data }),
    db.pushNotificationQueue.updateMany({ where: { status: "PROCESSING", updatedAt: { lt: staleBefore } }, data }),
  ]);

  return { emails: emails.count, pushes: pushes.count };
}

async function claimNextEmail() {
  const now = new Date();
  const candidate = await db.emailQueue.findFirst({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      scheduledFor: { lte: now },
      attempts: { lt: MAX_DELIVERY_ATTEMPTS },
    },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
  });
  if (!candidate) return null;

  try {
    return await db.emailQueue.update({
      where: {
        id: candidate.id,
        status: { in: ["PENDING", "FAILED"] },
        scheduledFor: { lte: now },
        attempts: { lt: MAX_DELIVERY_ATTEMPTS },
      },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });
  } catch (error) {
    if (isClaimRace(error)) return undefined;
    throw error;
  }
}

async function claimNextPush() {
  const now = new Date();
  const candidate = await db.pushNotificationQueue.findFirst({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      scheduledFor: { lte: now },
      attempts: { lt: MAX_DELIVERY_ATTEMPTS },
    },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
  });
  if (!candidate) return null;

  try {
    return await db.pushNotificationQueue.update({
      where: {
        id: candidate.id,
        status: { in: ["PENDING", "FAILED"] },
        scheduledFor: { lte: now },
        attempts: { lt: MAX_DELIVERY_ATTEMPTS },
      },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });
  } catch (error) {
    if (isClaimRace(error)) return undefined;
    throw error;
  }
}

export async function processNotificationQueues() {
  let emailSent = 0;
  let pushSent = 0;
  let failed = 0;
  const recovered = await recoverStalledQueueItems();

  let emailClaimAttempts = 0;
  let emailProcessed = 0;
  while (emailProcessed < MAX_ITEMS_PER_QUEUE_RUN && emailClaimAttempts < MAX_CLAIM_ATTEMPTS) {
    emailClaimAttempts += 1;
    const email = await claimNextEmail();
    if (email === null) break;
    if (email === undefined) continue;
    emailProcessed += 1;

    try {
      await sendQueuedEmail(email);
      await db.emailQueue.update({ where: { id: email.id, status: "PROCESSING" }, data: { status: "SENT", sentAt: new Date(), lastError: null } });
      if (email.referenceType === "SUPPLIER_NOTIFICATION_HISTORY" && email.referenceId) {
        await db.supplierNotificationHistory.update({
          where: { id: email.referenceId },
          data: { status: "SENT", sentAt: new Date(), failedAt: null, failureReason: null },
        }).catch(() => null);
      }
      emailSent += 1;
    } catch (error) {
      failed += 1;
      console.error(`Failed to send queued email ${email.id} to ${email.recipient}:`, error);
      await db.emailQueue.update({
        where: { id: email.id, status: "PROCESSING" },
        data: {
          status: "FAILED",
          lastError: error instanceof Error ? error.message : "Email failed",
          scheduledFor: new Date(Date.now() + RETRY_DELAY_MS),
        },
      });
      if (email.referenceType === "SUPPLIER_NOTIFICATION_HISTORY" && email.referenceId) {
        await db.supplierNotificationHistory.update({
          where: { id: email.referenceId },
          data: {
            status: "FAILED",
            failedAt: new Date(),
            failureReason: error instanceof Error ? error.message : "Email failed",
          },
        }).catch(() => null);
      }
    }
  }

  let pushClaimAttempts = 0;
  let pushProcessed = 0;
  while (pushProcessed < MAX_ITEMS_PER_QUEUE_RUN && pushClaimAttempts < MAX_CLAIM_ATTEMPTS) {
    pushClaimAttempts += 1;
    const push = await claimNextPush();
    if (push === null) break;
    if (push === undefined) continue;
    pushProcessed += 1;

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
      await db.pushNotificationQueue.update({ where: { id: push.id, status: "PROCESSING" }, data: { status: "SENT", sentAt: new Date(), lastError: null } });
      pushSent += 1;
    } catch (error) {
      failed += 1;
      console.error(`Failed to process push queue ${push.id}:`, error);
      await db.pushNotificationQueue.update({
        where: { id: push.id, status: "PROCESSING" },
        data: {
          status: "FAILED",
          lastError: error instanceof Error ? error.message : "Push failed",
          scheduledFor: new Date(Date.now() + RETRY_DELAY_MS),
        },
      });
    }
  }

  return { emailSent, pushSent, failed, recovered };
}