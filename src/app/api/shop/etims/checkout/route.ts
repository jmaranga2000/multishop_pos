import { NextResponse } from "next/server";
import { requireShop } from "@/lib/rbac";
import { submitEtimsCheckout } from "@/services/etims/etims-service";
import { etimsCheckoutSchema } from "@/validators/shop/etims-checkout-validator";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireShop();
  try {
    const input = etimsCheckoutSchema.parse(await request.json());
    const result = await submitEtimsCheckout(user, input);
    const successful = result.transaction.status === "ETIMS_SUCCESS";
    return NextResponse.json({
      ok: successful,
      saleId: result.sale.id,
      receiptNumber: result.sale.receiptNumber,
      checkoutMode: "ETIMS",
      etims: {
        status: result.transaction.status,
        officialInvoiceNumber: result.transaction.officialInvoiceNumber ?? null,
        fiscalDocumentNumber: result.transaction.fiscalDocumentNumber ?? null,
        controlCode: result.transaction.controlCode ?? null,
        qrCodeData: result.transaction.qrCodeData ?? null,
        errorCode: result.transaction.errorCode ?? null,
        errorMessage: result.transaction.errorMessage ?? null,
      },
      totals: {
        taxableMinor: Math.round(Number(result.transaction.taxableAmount) * 100),
        vatMinor: Math.round(Number(result.transaction.vatAmount) * 100),
        grossMinor: Math.round(Number(result.transaction.grossAmount) * 100),
        vatRate: Number(result.transaction.vatRate),
      },
    }, { status: successful ? 200 : 409 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fiscalize eTIMS sale.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}