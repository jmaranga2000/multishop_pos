import React, { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { getQuotationForPdf } from "@/services/shop/quotation-service";
import { QuotationPdfDocument, type QuotationData } from "@/components/shop/quotation";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = new URL(request.url).searchParams.get("token") ?? undefined;
    const user = token ? null : await requireUser();
    const quotation = await getQuotationForPdf({ id, token, businessId: user?.businessId ?? undefined, shopId: user?.role === "SHOP" ? user.shopId ?? undefined : undefined });
    const [business, shop] = await Promise.all([
      db.business.findUniqueOrThrow({ where: { id: quotation.businessId } }),
      db.shop.findUniqueOrThrow({ where: { id: quotation.shopId } }),
    ]);
    const data: QuotationData = {
      businessName: business.name,
      shopName: shop.name,
      physicalAddress: shop.address,
      phoneNumber: shop.phone,
      email: shop.email,
      quotationNumber: quotation.quotationNumber,
      issuedAt: new Date(quotation.issuedAt).toISOString(),
      validUntil: new Date(quotation.validUntil).toISOString(),
      cashierName: quotation.cashierName,
      counterName: quotation.counterName,
      customerName: quotation.customerName,
      items: quotation.items.map((item) => ({ ...item, name: item.productName })),
      subtotalMinor: quotation.subtotal,
      discountMinor: quotation.discountTotal,
      vatMinor: quotation.vatTotal,
      totalMinor: quotation.grandTotal,
      notes: quotation.notes,
      paymentInfo: {
        mpesaTill: business.quotationMpesaTill,
        mpesaPaybill: business.quotationMpesaPaybill,
        bankName: business.quotationBankName,
        bankAccountNumber: business.quotationBankAccountNumber,
        bankAccountName: business.quotationBankAccountName,
      },
    };
    const buffer = await renderToBuffer(createElement(QuotationPdfDocument, { data }) as Parameters<typeof renderToBuffer>[0]);
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="quotation-${quotation.quotationNumber}.pdf"`, "Cache-Control": "no-cache, no-store, must-revalidate" } });
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number((error as { status?: number }).status) || 400 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate quotation PDF." }, { status });
  }
}