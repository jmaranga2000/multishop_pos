import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { createDocumentNumber } from "@/lib/ids/document-number";
import { reconcileStockAlert } from "@/lib/stock-alerts";
import { writeAuditLog } from "@/services/shared/audit-service";
import type { z } from "zod";
import type {
  createStocktakeSchema,
  recordStocktakeCountsSchema,
  rejectStocktakeSchema,
  stocktakeIdSchema,
} from "@/validators/stocktake/stocktake-validator";

type AdminContext = { id: string; email: string; businessId: string };
type StocktakeActor = { id: string; businessId: string; shopId?: string | null; email?: string };
type CreateStocktakeInput = z.infer<typeof createStocktakeSchema>;
type CountInput = z.infer<typeof recordStocktakeCountsSchema>;
type StocktakeIdInput = z.infer<typeof stocktakeIdSchema>;
type RejectInput = z.infer<typeof rejectStocktakeSchema>;

type CountableStatus = "DRAFT" | "COUNTING";

type StocktakeLine = {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  systemQuantity: number;
  physicalQuantity?: number | null;
  varianceQuantity?: number | null;
  variancePercentage?: number | null;
  varianceReason?: string | null;
  reasonNote?: string | null;
};

function history(action: "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED" | "COMPLETED", userId: string, note?: string | null) {
  return { action, userId, occurredAt: new Date(), note: note || null };
}

function appendHistory(existing: Array<unknown> | null | undefined, entry: ReturnType<typeof history>) {
  return [...(existing ?? []), entry];
}

function isSignificantVariance(systemQuantity: number, physicalQuantity: number) {
  return Math.abs(physicalQuantity - systemQuantity) >= Math.max(1, Math.abs(systemQuantity) * 0.05);
}

async function scopedStocktake(actor: StocktakeActor, stocktakeId: string) {
  const record = await db.stocktake.findFirst({
    where: { id: stocktakeId, businessId: actor.businessId, ...(actor.shopId ? { shopId: actor.shopId } : {}) },
    include: { shop: true, items: { include: { product: true } } },
  });
  if (!record) throw new AppError("Stocktake not found for this shop.", "STOCKTAKE_NOT_FOUND", 404);
  return record;
}

export async function getStocktakeManagementData(businessId: string, shopId?: string) {
  const [shops, stocktakes, currentInventory] = await Promise.all([
    db.shop.findMany({ where: { businessId, isActive: true }, orderBy: { name: "asc" } }),
    db.stocktake.findMany({
      where: { businessId, ...(shopId ? { shopId } : {}) },
      include: { shop: true, items: { include: { product: true } } },
      orderBy: { startedAt: "desc" }, take: 150,
    }),
    db.shopInventory.findMany({
      where: { shop: { businessId }, ...(shopId ? { shopId } : {}) },
      include: { shop: true, product: true }, orderBy: [{ shop: { name: "asc" } }, { product: { name: "asc" } }],
    }),
  ]);
  const varianceHistory = stocktakes.flatMap((stocktake) => (stocktake.items as StocktakeLine[]).filter((item) => item.varianceQuantity !== undefined && item.varianceQuantity !== null && item.varianceQuantity !== 0).map((item) => ({ ...item, stocktake })));
  return { shops, stocktakes, currentInventory, varianceHistory };
}

export async function getShopStocktakeData(actor: Pick<StocktakeActor, "businessId" | "shopId"> & { shopId: string }) {
  return getStocktakeManagementData(actor.businessId, actor.shopId);
}

export async function startStocktake(actor: StocktakeActor, input: CreateStocktakeInput) {
  const shopId = actor.shopId ?? input.shopId;
  if (!shopId) throw new AppError("Select a shop to start stocktaking.");
  const [shop, existing, inventory] = await Promise.all([
    db.shop.findFirst({ where: { id: shopId, businessId: actor.businessId, isActive: true } }),
    db.stocktake.findFirst({ where: { businessId: actor.businessId, shopId, status: { in: ["DRAFT", "COUNTING", "SUBMITTED", "UNDER_REVIEW"] } } }),
    db.shopInventory.findMany({ where: { shopId }, include: { product: { include: { unit: true } } }, orderBy: { product: { name: "asc" } } }),
  ]);
  if (!shop) throw new AppError("Shop not found.", "SHOP_NOT_FOUND", 404);
  if (existing) throw new AppError(`Finish or cancel ${existing.stocktakeNumber} before starting another stocktake for this shop.`);
  if (!inventory.length) throw new AppError("There is no inventory to count at this shop.");

  return db.$transaction(async (tx) => {
    const stocktake = await tx.stocktake.create({
      data: {
        businessId: actor.businessId, shopId, stocktakeNumber: createDocumentNumber("STK", shop.code), status: "COUNTING",
        startedById: actor.id, startedAt: new Date(), notes: input.notes ?? null, approvalHistory: [],
        items: { create: inventory.map((row) => ({
          productId: row.productId, productName: row.product?.name ?? "Unknown product", sku: row.product?.sku ?? "-", barcode: row.product?.barcode ?? null,
          unitName: row.product?.unit?.name ?? null, unitSymbol: row.product?.unit?.symbol ?? null, systemQuantity: row.quantity,
        })) },
      },
      include: { items: true },
    });
    await writeAuditLog(tx, { userId: actor.id, shopId, action: "STOCKTAKE_STARTED", entityType: "STOCKTAKE", entityId: stocktake.id, description: `Started stocktake ${stocktake.stocktakeNumber} with ${inventory.length} inventory line${inventory.length === 1 ? "" : "s"}.` });
    return stocktake;
  });
}

export async function recordStocktakeCounts(actor: StocktakeActor, input: CountInput) {
  const stocktake = await scopedStocktake(actor, input.stocktakeId);
  if (!( ["DRAFT", "COUNTING"] as CountableStatus[]).includes(stocktake.status as CountableStatus)) {
    throw new AppError("Only active stocktakes can be counted.");
  }
  const itemsById = new Map<string, StocktakeLine>((stocktake.items as StocktakeLine[]).map((item): [string, StocktakeLine] => [item.id, item]));
  if (new Set(input.items.map((item) => item.stocktakeItemId)).size !== input.items.length) throw new AppError("Each stocktake line can only be counted once in a submission.");
  for (const count of input.items) {
    const item = itemsById.get(count.stocktakeItemId);
    if (!item) throw new AppError("A submitted count does not belong to this stocktake.");
    if (isSignificantVariance(item.systemQuantity, count.physicalQuantity) && !count.varianceReason) {
      throw new AppError(`${item.productName} has a significant variance. Select a reason before saving the count.`);
    }
  }
  return db.$transaction(async (tx) => {
    const currentStocktake = await tx.stocktake.findFirst({ where: { id: stocktake.id, businessId: actor.businessId, ...(actor.shopId ? { shopId: actor.shopId } : {}), status: { in: ["DRAFT", "COUNTING"] } } });
    if (!currentStocktake) throw new AppError("This stocktake is no longer active for counting.");
    for (const count of input.items) {
      const item = itemsById.get(count.stocktakeItemId)!;
      const varianceQuantity = count.physicalQuantity - item.systemQuantity;
      const variancePercentage = item.systemQuantity === 0 ? (count.physicalQuantity === 0 ? 0 : 100) : (varianceQuantity / item.systemQuantity) * 100;
      await tx.stocktakeItem.update({ where: { id: item.id }, data: { physicalQuantity: count.physicalQuantity, varianceQuantity, variancePercentage, varianceReason: count.varianceReason || undefined, reasonNote: count.reasonNote ?? null, countedById: actor.id, countedAt: new Date() } });
    }
    const updated = await tx.stocktake.update({ where: { id: stocktake.id }, data: { status: "COUNTING" } });
    await writeAuditLog(tx, { userId: actor.id, shopId: stocktake.shopId, action: "STOCKTAKE_COUNTS_RECORDED", entityType: "STOCKTAKE", entityId: stocktake.id, description: `Recorded ${input.items.length} count${input.items.length === 1 ? "" : "s"} for ${stocktake.stocktakeNumber}.` });
    return updated;
  });
}

export async function submitStocktake(actor: StocktakeActor, input: StocktakeIdInput) {
  const stocktake = await scopedStocktake(actor, input.stocktakeId);
  if (stocktake.status !== "COUNTING") throw new AppError("Only an active stocktake can be submitted for review.");
  const stocktakeItems = stocktake.items as StocktakeLine[];
  const uncounted = stocktakeItems.filter((item) => item.physicalQuantity === undefined || item.physicalQuantity === null);
  if (uncounted.length) throw new AppError(`${uncounted.length} product${uncounted.length === 1 ? " is" : "s are"} still uncounted.`);
  const missingReason = stocktakeItems.find((item) => isSignificantVariance(item.systemQuantity, item.physicalQuantity ?? item.systemQuantity) && !item.varianceReason);
  if (missingReason) throw new AppError(`${missingReason.productName} needs a documented variance reason before submission.`);
  const updated = await db.stocktake.update({ where: { id: stocktake.id }, data: { status: "SUBMITTED", submittedById: actor.id, submittedAt: new Date(), approvalHistory: appendHistory(stocktake.approvalHistory, history("SUBMITTED", actor.id, input.note)) } });
  await writeAuditLog(db, { userId: actor.id, shopId: stocktake.shopId, action: "STOCKTAKE_SUBMITTED", entityType: "STOCKTAKE", entityId: stocktake.id, description: `Submitted stocktake ${stocktake.stocktakeNumber} for manager review.`, metadata: { note: input.note ?? null } });
  return updated;
}

export async function approveStocktake(admin: AdminContext, input: StocktakeIdInput) {
  const stocktake = await scopedStocktake(admin, input.stocktakeId);
  if (stocktake.status !== "SUBMITTED" && stocktake.status !== "UNDER_REVIEW") throw new AppError("Only submitted stocktakes can be approved.");
  const stocktakeItems = stocktake.items as StocktakeLine[];
  if (stocktakeItems.some((item) => item.physicalQuantity === undefined || item.physicalQuantity === null)) throw new AppError("All stocktake lines must be counted before approval.");

  return db.$transaction(async (tx) => {
    const currentStocktake = await tx.stocktake.findFirst({ where: { id: stocktake.id, businessId: admin.businessId, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } });
    if (!currentStocktake) throw new AppError("This stocktake has already been reviewed or is no longer awaiting approval.");
    for (const item of stocktakeItems) {
      const current = await tx.shopInventory.findUnique({ where: { shopId_productId: { shopId: stocktake.shopId, productId: item.productId } } });
      if (!current) throw new AppError(`${item.productName} is no longer in this shop inventory. Resolve the stock record before approval.`);
      const physicalQuantity = item.physicalQuantity!;
      const adjusted = await tx.shopInventory.update({ where: { id: current.id }, data: { quantity: physicalQuantity, isAvailable: physicalQuantity > 0, version: { increment: 1 } } });
      const quantityChange = physicalQuantity - current.quantity;
      if (quantityChange !== 0) {
        await tx.stockMovement.create({ data: { shopId: stocktake.shopId, productId: item.productId, type: "STOCK_COUNT", quantityChange, quantityBefore: current.quantity, quantityAfter: physicalQuantity, referenceType: "STOCKTAKE", referenceId: stocktake.id, note: `Approved stocktake ${stocktake.stocktakeNumber}. ${item.varianceReason?.replaceAll("_", " ") ?? "Variance documented"}${item.reasonNote ? `: ${item.reasonNote}` : ""}` } });
      }
      await tx.stocktakeItem.update({ where: { id: item.id }, data: { adjustmentAppliedAt: new Date() } });
      await reconcileStockAlert(tx, { businessId: admin.businessId, shopId: stocktake.shopId, shopName: stocktake.shop?.name ?? "Shop", productId: item.productId, productName: item.productName, quantity: adjusted.quantity, reorderLevel: adjusted.reorderLevel, criticalLevel: adjusted.criticalLevel, adminId: admin.id, adminEmail: admin.email });
    }
    const completedAt = new Date();
    const updated = await tx.stocktake.update({ where: { id: stocktake.id }, data: { status: "COMPLETED", approvedById: admin.id, approvedAt: completedAt, completedAt, approvalHistory: appendHistory(appendHistory(stocktake.approvalHistory, history("APPROVED", admin.id, input.note)), history("COMPLETED", admin.id)) } });
    const varianceLines = stocktakeItems.filter((item) => item.physicalQuantity !== item.systemQuantity).length;
    await writeAuditLog(tx, { userId: admin.id, shopId: stocktake.shopId, action: "STOCKTAKE_APPROVED", entityType: "STOCKTAKE", entityId: stocktake.id, description: `Approved and applied stocktake ${stocktake.stocktakeNumber}.`, metadata: { varianceLines, note: input.note ?? null } });
    return updated;
  });
}

export async function rejectStocktake(admin: AdminContext, input: RejectInput) {
  const stocktake = await scopedStocktake(admin, input.stocktakeId);
  if (stocktake.status !== "SUBMITTED" && stocktake.status !== "UNDER_REVIEW") throw new AppError("Only submitted stocktakes can be rejected.");
  const updated = await db.stocktake.update({ where: { id: stocktake.id }, data: { status: "REJECTED", rejectedById: admin.id, rejectedAt: new Date(), rejectionReason: input.reason, approvalHistory: appendHistory(stocktake.approvalHistory, history("REJECTED", admin.id, input.reason)) } });
  await writeAuditLog(db, { userId: admin.id, shopId: stocktake.shopId, action: "STOCKTAKE_REJECTED", entityType: "STOCKTAKE", entityId: stocktake.id, description: `Rejected stocktake ${stocktake.stocktakeNumber}.`, metadata: { reason: input.reason } });
  return updated;
}

export async function cancelStocktake(actor: StocktakeActor, input: StocktakeIdInput) {
  const stocktake = await scopedStocktake(actor, input.stocktakeId);
  if (!["DRAFT", "COUNTING", "REJECTED"].includes(stocktake.status)) throw new AppError("Only an unapproved stocktake can be cancelled.");
  const updated = await db.stocktake.update({ where: { id: stocktake.id }, data: { status: "CANCELLED", cancelledAt: new Date(), approvalHistory: appendHistory(stocktake.approvalHistory, history("CANCELLED", actor.id, input.note)) } });
  await writeAuditLog(db, { userId: actor.id, shopId: stocktake.shopId, action: "STOCKTAKE_CANCELLED", entityType: "STOCKTAKE", entityId: stocktake.id, description: `Cancelled stocktake ${stocktake.stocktakeNumber}.` });
  return updated;
}