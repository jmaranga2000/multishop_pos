import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { writeAuditLog } from "@/services/shared/audit-service";

export async function listBusinessDevices(businessId: string) {
  return db.offlineDevice.findMany({
    where: { shop: { businessId } },
    include: { shop: true, _count: { select: { conflicts: true, syncBatches: true } } },
    orderBy: { lastSeenAt: "desc" },
  });
}

export async function getAdminDeviceById(businessId: string, deviceId: string) {
  return db.offlineDevice.findFirst({
    where: { id: deviceId, shop: { businessId } },
    include: {
      shop: true,
      syncBatches: {
        orderBy: { startedAt: "desc" },
        take: 10,
      },
      conflicts: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      _count: { select: { conflicts: true, syncBatches: true } },
    },
  });
}

export async function setDeviceAccess(
  admin: { id: string; businessId: string },
  input: { deviceId: string; enabled: boolean },
) {
  const device = await db.offlineDevice.findFirst({
    where: { id: input.deviceId, shop: { businessId: admin.businessId } },
    include: { shop: true },
  });
  if (!device) throw new AppError("Device was not found.", "DEVICE_NOT_FOUND", 404);
  return db.$transaction(async (tx) => {
    const updated = await tx.offlineDevice.update({
      where: { id: device.id },
      data: { isActive: input.enabled, isTrusted: input.enabled },
    });
    await writeAuditLog(tx, {
      userId: admin.id,
      shopId: device.shopId,
      action: input.enabled ? "DEVICE_TRUSTED" : "DEVICE_REVOKED",
      entityType: "OFFLINE_DEVICE",
      entityId: device.id,
      description: `${input.enabled ? "Trusted" : "Revoked"} ${device.name} for ${device.shop.name}.`,
    });
    return updated;
  });
}
