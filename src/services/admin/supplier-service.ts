import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { absoluteUrl } from "@/lib/utils";
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
  quantityNeeded: number;
  status: string;
  unit: string;
};

export async function getSupplierRestockItems(supplierId: string): Promise<SupplierRestockItem[]> {
  const supplier = await db.supplier.findFirst({
    where: { id: supplierId },
    include: { shop: true, supplierProducts: { include: { product: { include: { unit: true } } } } },
  });

  if (!supplier) throw new AppError("Supplier not found.", "SUPPLIER_NOT_FOUND", 404);
  if (!supplier.shop) throw new AppError("Supplier shop not found.", "SHOP_NOT_FOUND", 404);

  const productIds = supplier.supplierProducts.map((entry: { productId: string }) => entry.productId);
  const inventoryRows = await db.shopInventory.findMany({ where: { shopId: supplier.shopId, productId: { in: productIds } } });
  const inventoryByProductId = new Map(inventoryRows.map((entry: { productId: string; quantity: number }) => [entry.productId, entry.quantity]));

  return supplier.supplierProducts
    .map((entry: { id: string; productId: string; targetQuantity: number; product?: { name?: string | null; sku?: string | null; unit?: { symbol?: string | null } | null } | null }) => {
      const product = entry.product;
      const currentQuantity = inventoryByProductId.get(entry.productId) ?? 0;
      const targetQuantity = entry.targetQuantity;
      const quantityNeeded = targetQuantity - currentQuantity;
      return {
        supplierProductId: entry.id,
        productId: entry.productId,
        productName: product?.name ?? "Unknown product",
        sku: product?.sku ?? "-",
        currentQuantity,
        targetQuantity,
        quantityNeeded,
        status: currentQuantity <= 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
        unit: product?.unit?.symbol ?? "unit",
      };
    })
    .filter((item: { quantityNeeded: number }) => item.quantityNeeded > 0);
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
