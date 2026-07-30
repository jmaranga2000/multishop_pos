import { db } from "@/lib/db";
import { hashEndpoint } from "@/lib/notifications/service";

export async function savePushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  deviceName?: string;
  userAgent?: string | null;
}) {
  const endpointHash = hashEndpoint(input.endpoint);
  return db.pushSubscription.upsert({
    where: { endpointHash },
    update: {
      userId: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      deviceName: input.deviceName,
      isActive: true,
      failureCount: 0,
      lastUsedAt: new Date(),
    },
    create: {
      userId: input.userId,
      endpointHash,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      deviceName: input.deviceName,
      userAgent: input.userAgent,
      lastUsedAt: new Date(),
    },
  });
}

export async function disablePushSubscription(userId: string, endpoint: string) {
  return db.pushSubscription.updateMany({
    where: { userId, endpointHash: hashEndpoint(endpoint) },
    data: { isActive: false },
  });
}
