import { NextResponse } from "next/server";
import { requireShop } from "@/lib/rbac";
import { createShopQuotation, markQuotationConverted, searchShopQuotations } from "@/services/shop/quotation-service";

export async function POST(request: Request) {
  const user = await requireShop();
  try {
    const body = await request.json() as Record<string, any>;
    const quotation = await createShopQuotation(user, {
      shopId: user.shopId,
      counterId: body.counterId ?? null,
      cashierId: user.id,
      cashierName: String(body.cashierName ?? user.name),
      counterName: String(body.counterName ?? "Counter"),
      customerId: body.customerId ?? null,
      customerName: String(body.customerName ?? "Walk-in customer"),
      quotationNumber: String(body.quotationNumber),
      issuedAt: new Date(String(body.issuedAt)),
      validUntil: new Date(String(body.validUntil)),
      subtotal: Number(body.subtotal),
      discountTotal: Number(body.discountTotal),
      vatTotal: Number(body.vatTotal),
      grandTotal: Number(body.grandTotal),
      notes: body.notes ? String(body.notes) : null,
      items: Array.isArray(body.items) ? body.items : [],
    });
    const baseUrl = process.env.APP_URL?.replace(/\/$/, "") ?? new URL(request.url).origin;
    const pdfUrl = `${baseUrl}/api/quotations/${quotation.id}/pdf?token=${encodeURIComponent(quotation.shareToken)}`;
    return NextResponse.json({ ok: true, quotation, pdfUrl });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to save quotation." }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const user = await requireShop();
  const number = new URL(request.url).searchParams.get("number") ?? "";
  if (!number.trim()) return NextResponse.json({ ok: true, quotation: null });
  const quotation = await searchShopQuotations(user, number);
  return NextResponse.json({ ok: true, quotation });
}

export async function PATCH(request: Request) {
  const user = await requireShop();
  try {
    const body = await request.json() as { quotationId?: string; saleId?: string };
    if (!body.quotationId || !body.saleId) return NextResponse.json({ ok: false, error: "Quotation and sale references are required." }, { status: 400 });
    const quotation = await markQuotationConverted(user, body.quotationId, body.saleId);
    return NextResponse.json({ ok: true, quotation });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to convert quotation." }, { status: 409 });
  }
}