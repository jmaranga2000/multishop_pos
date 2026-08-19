import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { absoluteUrl, getStockStatus } from "@/lib/utils";
import { queueNotification } from "@/lib/notifications/service";
import { writeAuditLog } from "@/services/shared/audit-service";
import { renderToBuffer } from "@react-pdf/renderer";
import { SupplierRestockPdf } from "@/lib/reports/supplier-restock-pdf";
import React from "react";
import type { z } from "zod";
import type { createSupplierSchema, updateSupplierSchema, supplierProductAssignmentSchema } from "@/validators/admin/supplier-validator";

type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
type SupplierProductAssignmentInput = z.infer<typeof supplierProductAssignmentSchema>;

type AdminContext = { id: string; businessId: string };

export async function listSuppliers(businessId: string) {
  return db.supplier.findMany({
    where: { businessId },
    include: { shop: true, _count: { select: { supplierProducts: true } } },
    orderBy: [{ status: "desc" }, { name: "asc" }],
  });
}

export async function listSupplierProductsForBusiness(businessId: string) {
  return db.product.findMany({
    where: { businessId },
    include: { unit: true },
    orderBy: { name: "asc" },
  });
}

export async function getSupplierById(businessId: string, supplierId: string) {
  return db.supplier.findFirst({
    where: { id: supplierId, businessId },
    include: { shop: true, supplierProducts: { include: { product: { include: { unit: true } } } } },
  });
}

export async function getSupplierManagementDetails(businessId: string, supplierId: string) {
  const supplier = await getSupplierById(businessId, supplierId);
  if (!supplier) return null;

  const productIds = supplier.supplierProducts.map((entry: { productId: string }) => entry.productId);
  const inventory = await db.shopInventory.findMany({
    where: { shopId: supplier.shopId, productId: { in: productIds } },
  });
  const inventoryMap = new Map(inventory.map((entry: { productId: string; quantity: number }) => [entry.productId, entry.quantity]));

  return {
    supplier,
    inventoryMap,
  };
}

export async function createSupplier(admin: AdminContext, input: CreateSupplierInput, productIds: string[] = []) {
  const shop = await db.shop.findFirst({ where: { id: input.shopId, businessId: admin.businessId } });
  if (!shop) throw new AppError("The assigned shop was not found.", "SHOP_NOT_FOUND", 404);

  const supplier = await db.supplier.create({
    data: {
      businessId: admin.businessId,
      shopId: shop.id,
      name: input.name,
      company: input.company,
      email: input.email,
      phone: input.phone,
      alternativePhone: input.alternativePhone || null,
      address: input.address || null,
      notes: input.notes || null,
      status: input.status,
    },
  });

  await writeAuditLog(db, {
    userId: admin.id,
    shopId: shop.id,
    action: "SUPPLIER_CREATED",
    entityType: "SUPPLIER",
    entityId: supplier.id,
    description: `Created supplier ${supplier.name} for ${shop.name}.`,
  });

  const uniqueProductIds = [...new Set(productIds.filter(Boolean))];
  if (uniqueProductIds.length) {
    await db.supplierProduct.createMany({
      data: uniqueProductIds.map((productId) => ({
        supplierId: supplier.id,
        shopId: shop.id,
        productId,
        targetQuantity: 0,
      })),
    });
  }

  return supplier;
}

export async function updateSupplier(admin: AdminContext, input: UpdateSupplierInput, productIds: string[] = []) {
  const supplier = await db.supplier.findFirst({ where: { id: input.supplierId, businessId: admin.businessId } });
  if (!supplier) throw new AppError("Supplier not found.", "SUPPLIER_NOT_FOUND", 404);

  const shop = await db.shop.findFirst({ where: { id: input.shopId, businessId: admin.businessId } });
  if (!shop) throw new AppError("The assigned shop was not found.", "SHOP_NOT_FOUND", 404);

  const updated = await db.supplier.update({
    where: { id: supplier.id },
    data: {
      shopId: shop.id,
      name: input.name,
      company: input.company,
      email: input.email,
      phone: input.phone,
      alternativePhone: input.alternativePhone || null,
      address: input.address || null,
      notes: input.notes || null,
      status: input.status,
    },
  });

  await writeAuditLog(db, {
    userId: admin.id,
    shopId: shop.id,
    action: "SUPPLIER_UPDATED",
    entityType: "SUPPLIER",
    entityId: updated.id,
    description: `Updated supplier ${updated.name}.`,
  });

  const uniqueProductIds = [...new Set(productIds.filter(Boolean))];
  await db.supplierProduct.deleteMany({ where: { supplierId: updated.id } });
  if (uniqueProductIds.length) {
    await db.supplierProduct.createMany({
      data: uniqueProductIds.map((productId) => ({
        supplierId: updated.id,
        shopId: shop.id,
        productId,
        targetQuantity: 0,
      })),
    });
  }

  return updated;
}

export async function deleteSupplier(admin: AdminContext, supplierId: string) {
  const supplier = await db.supplier.findFirst({ where: { id: supplierId, businessId: admin.businessId } });
  if (!supplier) throw new AppError("Supplier not found.", "SUPPLIER_NOT_FOUND", 404);

  await db.supplierProduct.deleteMany({ where: { supplierId: supplier.id } });
  await db.supplier.deleteMany({ where: { id: supplier.id } });

  await writeAuditLog(db, {
    userId: admin.id,
    shopId: supplier.shopId,
    action: "SUPPLIER_DELETED",
    entityType: "SUPPLIER",
    entityId: supplier.id,
    description: `Deleted supplier ${supplier.name}.`,
  });
}

export async function assignSupplierProducts(admin: AdminContext, input: SupplierProductAssignmentInput) {
  const supplier = await db.supplier.findFirst({ where: { id: input.supplierId, businessId: admin.businessId } });
  if (!supplier) throw new AppError("Supplier not found.", "SUPPLIER_NOT_FOUND", 404);

  await db.$transaction(async (tx) => {
    await tx.supplierProduct.deleteMany({ where: { supplierId: supplier.id } });

    if (!input.productIds?.length) return;

    await tx.supplierProduct.createMany({
      data: input.productIds.map((productId) => ({
        supplierId: supplier.id,
        shopId: supplier.shopId,
        productId,
        targetQuantity: input.targetQuantities?.[productId] ?? 0,
      })),
    });
  });

  return getSupplierById(admin.businessId, supplier.id);
}

export async function updateSupplierProductTarget(admin: AdminContext, supplierProductId: string, targetQuantity: number) {
  const record = await db.supplierProduct.findFirst({ where: { id: supplierProductId, supplier: { businessId: admin.businessId } } });
  if (!record) throw new AppError("Supplier product assignment not found.", "SUPPLIER_PRODUCT_NOT_FOUND", 404);

  return db.supplierProduct.update({ where: { id: record.id }, data: { targetQuantity } });
}

type SupplierRestockItem = {
  supplierProductId: string;
  productId: string;
  productName: string;
  sku: string;
  currentQuantity: number;
  targetQuantity: number;
  reorderLevel: number;
  criticalLevel: number;
  reorderQuantity: number;
  quantityNeeded: number;
  status: "IN_STOCK" | "LOW_STOCK" | "CRITICAL" | "OUT_OF_STOCK";
  unit: string;
  lastNotifiedQuantity: number | null;
  lastNotifiedStatus: string | null;
};

type DatabaseClient = typeof db | any;

export function calculateSupplierRestockQuantity(currentQuantity: number, targetQuantity: number, reorderLevel: number, reorderQuantity: number, status: SupplierRestockItem["status"]) {
  if (targetQuantity > currentQuantity) return targetQuantity - currentQuantity;
  if (status === "IN_STOCK") return 0;
  return Math.max(1, reorderQuantity, reorderLevel - currentQuantity);
}

export async function getSupplierRestockItems(supplierId: string, client: DatabaseClient = db): Promise<SupplierRestockItem[]> {
  const supplier = await client.supplier.findFirst({
    where: { id: supplierId },
    include: { shop: true, supplierProducts: { include: { product: { include: { unit: true } } } } },
  });

  if (!supplier) throw new AppError("Supplier not found.", "SUPPLIER_NOT_FOUND", 404);
  if (!supplier.shop) throw new AppError("Supplier shop not found.", "SHOP_NOT_FOUND", 404);

  const productIds = supplier.supplierProducts.map((entry: { productId: string }) => entry.productId);
  const inventoryRows = await client.shopInventory.findMany({ where: { shopId: supplier.shopId, productId: { in: productIds } } });
  const inventoryByProductId = new Map(inventoryRows.map((entry: { productId: string }) => [entry.productId, entry]));

  return supplier.supplierProducts
    .map((entry: { id: string; productId: string; targetQuantity: number; lastNotifiedQuantity?: number | null; lastNotifiedStatus?: string | null; product?: { name?: string | null; sku?: string | null; status?: string | null; unit?: { symbol?: string | null } | null } | null }) => {
      const product = entry.product;
      const inventory = inventoryByProductId.get(entry.productId) as { quantity?: number; reorderLevel?: number; criticalLevel?: number; reorderQuantity?: number } | undefined;
      const currentQuantity = Number(inventory?.quantity ?? 0);
      const targetQuantity = Math.max(0, Number(entry.targetQuantity ?? 0));
      const reorderLevel = Math.max(0, Number(inventory?.reorderLevel ?? 0));
      const criticalLevel = Math.max(0, Number(inventory?.criticalLevel ?? 0));
      const reorderQuantity = Math.max(0, Number(inventory?.reorderQuantity ?? 0));
      const status = getStockStatus(currentQuantity, reorderLevel, criticalLevel);
      const quantityNeeded = calculateSupplierRestockQuantity(currentQuantity, targetQuantity, reorderLevel, reorderQuantity, status);
      return {
        supplierProductId: entry.id,
        productId: entry.productId,
        productName: product?.name ?? "Unknown product",
        sku: product?.sku ?? "-",
        currentQuantity,
        targetQuantity,
        reorderLevel,
        criticalLevel,
        reorderQuantity,
        quantityNeeded,
        status,
        unit: product?.unit?.symbol ?? "unit",
        lastNotifiedQuantity: entry.lastNotifiedQuantity ?? null,
        lastNotifiedStatus: entry.lastNotifiedStatus ?? null,
        active: product?.status !== "INACTIVE",
      };
    })
    .filter((item: SupplierRestockItem & { active: boolean }) => item.active && item.quantityNeeded > 0)
    .map(({ active: _active, ...item }: SupplierRestockItem & { active: boolean }) => item);
}

function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] ?? character));
}

function buildAutomaticRestockEmail(supplierName: string, shopName: string, referenceNumber: string, items: SupplierRestockItem[], pdfUrl: string | null) {
  const rows = items.map((item) => `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeEmailHtml(item.productName)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${item.quantityNeeded}</td></tr>`).join("");
  const pdfLink = pdfUrl ? `<p><a href="${escapeEmailHtml(pdfUrl)}">Download the current restock request PDF</a></p>` : "";
  return `<div style="font-family:Arial,sans-serif;color:#111827"><h1>Restock request</h1><p>Hello ${escapeEmailHtml(supplierName)},</p><p>${escapeEmailHtml(shopName)} has products that require restocking.</p><p>Reference: <strong>${escapeEmailHtml(referenceNumber)}</strong></p><table style="width:100%;border-collapse:collapse"><thead><tr><th align="left" style="padding:8px">Product</th><th align="left" style="padding:8px">Needed number</th></tr></thead><tbody>${rows}</tbody></table>${pdfLink}</div>`;
}

export async function queueAutomaticSupplierRestockRequests(client: DatabaseClient, input: { businessId: string; shopId: string; productId: string; userId: string; shopName: string }) {
  const assignments = await client.supplierProduct.findMany({
    where: { shopId: input.shopId, productId: input.productId },
    include: { supplier: true },
  });
  let queued = 0;

  for (const assignment of assignments as Array<{ supplier?: { id: string; businessId: string; name: string; email: string; status: string } | null }>) {
    const supplier = assignment.supplier;
    if (!supplier || supplier.businessId !== input.businessId || supplier.status !== "ACTIVE" || !supplier.email?.trim()) continue;

    const items = await getSupplierRestockItems(supplier.id, client);
    const changedItems = items.filter((item) => item.lastNotifiedQuantity !== item.currentQuantity || item.lastNotifiedStatus !== item.status);
    if (!changedItems.length) continue;

    const referenceNumber = `RST-AUTO-${Date.now()}-${supplier.id.slice(-6)}-${randomBytes(3).toString("hex")}`;
    const history = await client.supplierNotificationHistory.create({
      data: {
        businessId: input.businessId,
        shopId: input.shopId,
        supplierId: supplier.id,
        referenceNumber,
        status: "PENDING",
        notificationType: "RESTOCK_REQUEST",
        productCount: items.length,
        emailAddress: supplier.email.trim(),
        subject: `Restock request from ${input.shopName}`,
        pdfUrl: null,
      },
    });
    const pdfToken = randomBytes(32).toString("hex");
    const pdfUrl = process.env.APP_URL?.trim() ? absoluteUrl(`/api/supplier-notifications/${history.id}/pdf?token=${pdfToken}`) : null;
    await client.supplierNotificationHistory.update({ where: { id: history.id }, data: { pdfUrl, pdfToken } });
    await queueNotification({
      tx: client,
      businessId: input.businessId,
      userId: input.userId,
      shopId: input.shopId,
      type: "SYSTEM",
      priority: items.some((item) => item.status === "OUT_OF_STOCK") ? "URGENT" : "HIGH",
      title: `Restock request sent to ${supplier.name}`,
      message: `${items.length} assigned product${items.length === 1 ? "" : "s"} require restocking at ${input.shopName}.`,
      actionUrl: `/admin/suppliers/${supplier.id}`,
      inApp: true,
      push: false,
      email: {
        to: supplier.email.trim(),
        subject: `Restock request from ${input.shopName}`,
        html: buildAutomaticRestockEmail(supplier.name, input.shopName, referenceNumber, items, pdfUrl),
        referenceType: "SUPPLIER_NOTIFICATION_HISTORY",
        referenceId: history.id,
      },
    });
    await Promise.all(items.map((item) => client.supplierProduct.update({
      where: { id: item.supplierProductId },
      data: { lastNotificationAt: new Date(), lastNotifiedQuantity: item.currentQuantity, lastNotifiedStatus: item.status },
    })));
    queued += 1;
  }

  return queued;
}

export async function generateSupplierRestockRequest(admin: AdminContext, supplierId: string) {
  const supplier = await db.supplier.findFirst({ where: { id: supplierId, businessId: admin.businessId }, include: { shop: true } });
  if (!supplier) throw new AppError("Supplier not found.", "SUPPLIER_NOT_FOUND", 404);
  if (supplier.status !== "ACTIVE") throw new AppError("Cannot generate a restock request for an inactive supplier.", "SUPPLIER_INACTIVE", 400);

  const items = await getSupplierRestockItems(supplier.id);
  if (!items.length) throw new AppError("No products require restocking for this supplier.", "NO_RESTOCK_ITEMS", 400);

  const referenceNumber = `RST-${Date.now()}-${supplier.id.slice(0, 6)}`;
  const history = await db.supplierNotificationHistory.create({
    data: {
      businessId: admin.businessId,
      shopId: supplier.shopId,
      supplierId: supplier.id,
      referenceNumber,
      status: "PENDING",
      notificationType: "RESTOCK_REQUEST",
      productCount: items.length,
      emailAddress: supplier.email,
      subject: `Restock request ${supplier.name}`,
      pdfUrl: null,
    },
  });

  const pdfToken = randomBytes(32).toString("hex");
  const pdfUrl = absoluteUrl(`/api/supplier-notifications/${history.id}/pdf?token=${pdfToken}`);
  await db.supplierNotificationHistory.update({ where: { id: history.id }, data: { pdfUrl, pdfToken } });

  const products = items.map((item: SupplierRestockItem) => ({
    productName: item.productName,
    sku: item.sku,
    currentQuantity: item.currentQuantity,
    targetQuantity: item.targetQuantity,
    quantityNeeded: item.quantityNeeded,
    status: item.status,
    unit: item.unit,
  }));

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;">
      <h1>Restock request</h1>
      <p>A new restock request has been generated for ${supplier.name} at ${supplier.shop?.name ?? "your assigned shop"}.</p>
      <p>Reference: <strong>${history.referenceNumber}</strong></p>
      <p><a href="${pdfUrl}">Download the purchase request PDF</a></p>
    </div>
  `;

  const pdfDoc = React.createElement(SupplierRestockPdf, {
    shopName: supplier.shop?.name ?? "Unknown shop",
    supplierName: supplier.name,
    supplierCompany: supplier.company,
    supplierEmail: supplier.email,
    supplierPhone: supplier.phone,
    shopAddress: supplier.address ?? undefined,
    referenceNumber: history.referenceNumber,
    products,
    generatedAt: new Date().toISOString(),
  }) as any;
  const pdfBuffer = await renderToBuffer(pdfDoc as any);
  const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

  if (!supplier.email?.trim()) {
    console.error(`Supplier ${supplier.id} has no email address configured. Cannot send restock request.`);
    await db.supplierNotificationHistory.update({
      where: { id: history.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureReason: "Supplier email address is missing.",
      },
    }).catch(() => null);
    return history;
  }

  console.info(`Queueing supplier restock email to ${supplier.email} for supplier ${supplier.id}, history ${history.id}`);

  await queueNotification({
    businessId: admin.businessId,
    userId: admin.id,
    shopId: supplier.shopId,
    type: "SYSTEM",
    priority: "NORMAL",
    title: `Restock request created for ${supplier.name}`,
    message: `${supplier.name} has ${items.length} items waiting to be ordered.`,
    actionUrl: `/admin/suppliers/${supplier.id}`,
    inApp: true,
    push: true,
    email: {
      to: supplier.email,
      subject: history.subject,
      html,
      referenceType: "SUPPLIER_NOTIFICATION_HISTORY",
      referenceId: history.id,
      attachments: [
        {
          filename: `restock-request-${history.referenceNumber}.pdf`,
          contentType: "application/pdf",
          content: pdfBase64,
        },
      ],
    },
  });

  return history;
}

export async function getSupplierNotificationHistory(businessId: string, filters: { supplierId?: string; shopId?: string; status?: "PENDING" | "SENT" | "FAILED"; fromDate?: string; toDate?: string; }) {
  const where: Record<string, unknown> = { businessId };
  if (filters.supplierId) where.supplierId = filters.supplierId;
  if (filters.shopId) where.shopId = filters.shopId;
  if (filters.status) where.status = filters.status;
  if (filters.fromDate || filters.toDate) {
    where.createdAt = {} as Record<string, unknown>;
    if (filters.fromDate) (where.createdAt as Record<string, unknown>).gte = new Date(filters.fromDate);
    if (filters.toDate) (where.createdAt as Record<string, unknown>).lte = new Date(filters.toDate);
  }

  return db.supplierNotificationHistory.findMany({ where, orderBy: { createdAt: "desc" } });
}

export async function getSupplierNotificationById(businessId: string, historyId: string) {
  return db.supplierNotificationHistory.findFirst({ where: { id: historyId, businessId } });
}

export async function isSupplierEmailAllowed(supplierId: string, shopId: string) {
  const supplier = await db.supplier.findFirst({ where: { id: supplierId, shopId } });
  return Boolean(supplier);
}

export async function getSupplierNotificationDashboard(businessId: string) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [sentCount, failedCount, pendingCount, productsAwaiting] = await Promise.all([
    db.supplierNotificationHistory.count({ where: { businessId, status: "SENT", createdAt: { gte: todayStart } } }),
    db.supplierNotificationHistory.count({ where: { businessId, status: "FAILED", createdAt: { gte: todayStart } } }),
    db.supplierNotificationHistory.count({ where: { businessId, status: "PENDING", createdAt: { gte: todayStart } } }),
    db.supplierProduct.count({ where: { supplier: { business: { id: businessId } }, targetQuantity: { gt: 0 } } }),
  ]);

  return { sentCount, failedCount, pendingCount, productsAwaiting };
}
