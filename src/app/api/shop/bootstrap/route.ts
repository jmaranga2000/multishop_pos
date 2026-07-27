import { NextResponse } from "next/server";
import { requireShop } from "@/lib/rbac";
import { bootstrapShopDevice } from "@/services/shop/bootstrap-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireShop();
  const url = new URL(request.url);
  const deviceId = url.searchParams.get("deviceId");
  if (!deviceId) return NextResponse.json({ error: "deviceId is required" }, { status: 400 });

  const payload = await bootstrapShopDevice({
    businessId: user.businessId,
    shopId: user.shopId,
    shopName: user.shop.name,
    deviceId,
    deviceName: request.headers.get("x-device-name"),
    platform: request.headers.get("sec-ch-ua-platform"),
    userAgent: request.headers.get("user-agent"),
  });
  return NextResponse.json(payload);
}
