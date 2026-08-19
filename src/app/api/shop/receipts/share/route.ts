import { NextResponse } from "next/server";
import { z } from "zod";
import { requireShop } from "@/lib/rbac";
import { createReceiptShareToken } from "@/lib/receipt-share-token";

const receiptSchema = z.object({
  businessName: z.string(),
  shopLocation: z.string().nullable().optional(),
  shopContact: z.string().nullable().optional(),
  taxInfo: z.string().nullable().optional(),
  receiptNumber: z.string().min(1),
  occurredAt: z.string(),
  cashierName: z.string(),
  customerName: z.string(),
  checkoutMode: z.enum(["NORMAL", "ETIMS"]).optional(),
  taxableMinor: z.number().optional(),
  vatRate: z.number().optional(),
  etims: z.record(z.string(), z.unknown()).nullable().optional(),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    unitName: z.string().nullable().optional(),
    unitSymbol: z.string().nullable().optional(),
    unitPriceMinor: z.number(),
    lineTotalMinor: z.number(),
  })),
  subtotalMinor: z.number(),
  discountMinor: z.number(),
  taxMinor: z.number(),
  grandTotalMinor: z.number(),
  paymentMethod: z.string(),
  amountPaidMinor: z.number(),
  creditAmountMinor: z.number().optional(),
  outstandingMinor: z.number().optional(),
  changeDueMinor: z.number(),
  paymentReference: z.string().nullable().optional(),
  receiptFooter: z.string().nullable().optional(),
  returnPolicy: z.string().nullable().optional(),
  thankYouMessage: z.string().nullable().optional(),
  qrCodeDataUrl: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    await requireShop();
    const body = await request.json();
    const receipt = receiptSchema.parse(body);
    const token = createReceiptShareToken(receipt);
    const url = new URL(`/receipt/${encodeURIComponent(token)}`, request.url);
    return NextResponse.json({ ok: true, url: url.toString(), expiresInDays: 7 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to create receipt link." }, { status: 400 });
  }
}
