import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireShop } from "@/lib/rbac";
import { getCounterAccess } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireShop();
    const [business, shop, counterAccess] = await Promise.all([
      db.business.findUnique({
        where: { id: user.businessId },
        select: {
          name: true,
          taxPin: true,
          receiptFooter: true,
          quotationMpesaTill: true,
          quotationMpesaPaybill: true,
          quotationBankName: true,
          quotationBankAccountNumber: true,
          quotationBankAccountName: true,
        },
      }),
      db.shop.findUnique({
        where: { id: user.shopId },
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          email: true,
        },
      }),
      getCounterAccess(user),
    ]);

    const location = shop?.address ?? null;
    const contact = shop?.phone ?? null;
    const taxInfo = business?.taxPin ? `PIN: ${business.taxPin}` : null;

    return NextResponse.json({
      ok: true,
      businessName: business?.name ?? shop?.name ?? "MultiShop POS",
      shopName: shop?.name ?? business?.name ?? "MultiShop POS",
      shopLocation: location,
      shopContact: contact,
      shopEmail: shop?.email ?? null,
      taxInfo,
      receiptFooter: business?.receiptFooter ?? null,
      cashierName: user.name,
      counterId: counterAccess?.counterId ?? null,
      counterName: counterAccess?.counter?.name ?? "Counter",
      paymentInfo: {
        mpesaTill: business?.quotationMpesaTill ?? null,
        mpesaPaybill: business?.quotationMpesaPaybill ?? null,
        bankName: business?.quotationBankName ?? null,
        bankAccountNumber: business?.quotationBankAccountNumber ?? null,
        bankAccountName: business?.quotationBankAccountName ?? null,
      },
      returnPolicy: "Returns accepted within 7 days with original receipt.",
      thankYouMessage: "Thank you for shopping with us.",
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
