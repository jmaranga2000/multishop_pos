import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireShop } from "@/lib/rbac";

export async function GET() {
  try {
    const user = await requireShop();
    const [business, shop] = await Promise.all([
      db.business.findUnique({
        where: { id: user.businessId },
        select: {
          name: true,
          address: true,
          phone: true,
          email: true,
          taxPin: true,
          receiptFooter: true,
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
    ]);

    const location = [shop?.address, business?.address].find(Boolean) ?? null;
    const contact = [shop?.phone, shop?.email, business?.phone, business?.email].filter(Boolean).join(" • ") || null;
    const taxInfo = business?.taxPin ? `PIN: ${business.taxPin}` : null;

    return NextResponse.json({
      ok: true,
      businessName: business?.name ?? shop?.name ?? "MultiShop POS",
      shopName: shop?.name ?? business?.name ?? "MultiShop POS",
      shopLocation: location,
      shopContact: contact,
      taxInfo,
      receiptFooter: business?.receiptFooter ?? null,
      cashierName: user.name,
      returnPolicy: "Returns accepted within 7 days with original receipt.",
      thankYouMessage: "Thank you for shopping with us.",
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
