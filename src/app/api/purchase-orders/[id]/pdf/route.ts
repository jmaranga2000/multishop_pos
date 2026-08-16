/** @jsxImportSource react */
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { PurchaseOrderPdf } from "@/lib/reports/purchase-order-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(); const { id } = await params;
    const order = await db.purchaseOrder.findFirst({ where: { id, businessId: user.businessId, ...(user.role === "SHOP" ? { shopId: user.shopId } : {}) }, include: { shop: true, supplier: true, items: true } });
    if (!order || !order.shop || !order.supplier) throw new AppError("Purchase order not found.", "PURCHASE_ORDER_NOT_FOUND", 404);
    const document = React.createElement(PurchaseOrderPdf, { orderNumber: order.purchaseOrderNumber, orderDate: order.orderDate.toLocaleDateString("en-KE"), expectedDeliveryDate: order.expectedDeliveryDate?.toLocaleDateString("en-KE") ?? null, shopName: order.shop.name, supplierName: order.supplier.name, supplierCompany: order.supplier.company, supplierEmail: order.supplier.email, supplierPhone: order.supplier.phone, notes: order.notes, subtotal: order.subtotal, taxTotal: order.taxTotal, grandTotal: order.grandTotal, items: order.items.map((item) => ({ productName: item.productName, unitName: item.unitName, quantity: item.orderedQuantity, unitCost: item.unitCost, taxRate: item.taxRate, lineTotal: item.lineTotal })) }) as any;
    const buffer = await renderToBuffer(document as any);
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="purchase-order-${order.purchaseOrderNumber}.pdf"`, "Cache-Control": "no-cache, no-store, must-revalidate" } });
  } catch (error) {
    if (error instanceof AppError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Unable to generate purchase-order PDF:", error); return Response.json({ error: "Failed to generate purchase-order PDF" }, { status: 500 });
  }
}