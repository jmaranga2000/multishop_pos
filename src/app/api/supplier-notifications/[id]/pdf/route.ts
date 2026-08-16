/** @jsxImportSource react */
import { renderToBuffer } from "@react-pdf/renderer";
import { getSupplierNotificationById, getSupplierRestockItems } from "@/services/admin/supplier-service";
import { db } from "@/lib/db";
import { SupplierRestockPdf } from "@/lib/reports/supplier-restock-pdf";
import { AppError } from "@/lib/errors/app-error";
import { requireUser } from "@/lib/rbac";
import React from "react";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: notificationId } = await params;
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    let history;
    let userBusinessId: string | null = null;
    if (token) {
      history = await db.supplierNotificationHistory.findFirst({ where: { id: notificationId, pdfToken: token } });
    } else {
      const user = await requireUser();
      userBusinessId = user.businessId;
      history = await getSupplierNotificationById(userBusinessId, notificationId);
    }
    if (!history) throw new AppError("Notification not found.", "NOTIFICATION_NOT_FOUND", 404);

    const supplier = await db.supplier.findFirst({
      where: token ? { id: history.supplierId } : { id: history.supplierId, businessId: userBusinessId! },
      include: { shop: true },
    });
    if (!supplier) throw new AppError("Supplier not found.", "SUPPLIER_NOT_FOUND", 404);

    const products = (await getSupplierRestockItems(supplier.id)).map((item) => ({
      productName: item.productName,
      sku: item.sku,
      currentQuantity: item.currentQuantity,
      targetQuantity: item.targetQuantity,
      quantityNeeded: item.quantityNeeded,
      status: item.status,
      unit: item.unit,
    }));
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
      return new Response(JSON.stringify({ error: error.message }), {
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