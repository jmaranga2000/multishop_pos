type DbClient = { auditLog: any } & Record<string, any>;

type AuditInput = {
  userId?: string | null;
  shopId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  description: string;
  metadata?: unknown;
};

export async function writeAuditLog(db: DbClient, input: AuditInput) {
  return db.auditLog.create({
    data: {
      userId: input.userId ?? null,
      shopId: input.shopId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      description: input.description,
      metadata: input.metadata,
    },
  });
}
