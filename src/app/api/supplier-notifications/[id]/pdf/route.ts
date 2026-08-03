/** @jsxImportSource react */
import { renderToBuffer } from "@react-pdf/renderer";
import { getSupplierNotificationById } from "@/services/admin/supplier-service";
import { db } from "@/lib/db";
import { SupplierRestockPdf } from "@/lib/reports/supplier-restock-pdf";
import { AppError } from "@/lib/errors/app-error";
import { requireUser } from "@/lib/rbac";
import React from "react";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: notificationId } = await params;
    const user = await requireUser();

    const history = await getSupplierNotificationById(user.businessId, notificationId);
    if (!history) throw new AppError("Notification not found.", "NOTIFICATION_NOT_FOUND", 404);

    const supplier = await db.supplier.findFirst({
      where: { id: history.supplierId, businessId: user.businessId },
      include: { shop: true },
    });
    if (!supplier) throw new AppError("Supplier not found.", "SUPPLIER_NOT_FOUND", 404);

    const supplierProducts = await db.supplierProduct.findMany({
      where: { supplierId: supplier.id },
      include: { product: { include: { unit: true } } },
    });

    const productIds = supplierProducts.map((entry) => entry.productId);
    const inventoryRows = await db.shopInventory.findMany({
      where: { shopId: supplier.shopId, productId: { in: productIds } },
    });
    const inventoryByProductId = new Map(inventoryRows.map((entry) => [entry.productId, entry.quantity]));

    const products = supplierProducts
      .map((entry) => {
        const product = entry.product;
        const currentQuantity = inventoryByProductId.get(entry.productId) ?? 0;
        const targetQuantity = entry.targetQuantity;
        const quantityNeeded = Math.max(0, targetQuantity - currentQuantity);

        return {
          productName: product?.name ?? "Unknown product",
          sku: product?.sku ?? "-",
          currentQuantity,
          targetQuantity,
          quantityNeeded,
          status: currentQuantity <= 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
          unit: product?.unit?.symbol ?? "unit",
        };
      })
      .filter((item) => item.quantityNeeded > 0);

    const doc = React.createElement(SupplierRestockPdf, {
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

    const buffer = await renderToBuffer(doc as any);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="restock-${history.referenceNumber}.pdf"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: error.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.error("Error generating supplier restock PDF:", error);
    return new Response(JSON.stringify({ error: "Failed to generate PDF" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
