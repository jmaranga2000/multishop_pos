import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors/app-error";
import { writeAuditLog } from "@/services/shared/audit-service";

export async function getSynchronizationMonitorData(businessId: string) {
  const [batches, conflicts] = await Promise.all([
    prisma.offlineSyncBatch.findMany({
      where: { shop: { businessId } },
      include: { shop: true, device: true },
      orderBy: { startedAt: "desc" },
      take: 100,
    }),
    prisma.offlineSyncConflict.findMany({
      where: { shop: { businessId }, status: "OPEN" },
      include: { shop: true, device: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return { batches, conflicts };
}

export async function resolveSynchronizationConflict(
  admin: { id: string; businessId: string },
  conflictId: string,
) {
  const conflict = await prisma.offlineSyncConflict.findFirst({
    where: { id: conflictId, shop: { businessId: admin.businessId } },
    include: { shop: true },
  });
  if (!conflict) throw new AppError("Synchronization conflict was not found.", "SYNC_CONFLICT_NOT_FOUND", 404);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.offlineSyncConflict.update({
      where: { id: conflict.id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
    await writeAuditLog(tx, {
      userId: admin.id,
      shopId: conflict.shopId,
      action: "SYNC_CONFLICT_RESOLVED",
      entityType: "OFFLINE_SYNC_CONFLICT",
      entityId: conflict.id,
      description: `Resolved ${conflict.type.replaceAll("_", " ")} for ${conflict.shop.name}.`,
    });
    return updated;
  });
}
