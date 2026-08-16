import { redirect } from "next/navigation";
import { PosShell } from "@/components/shop/pos-shell";
import { db } from "@/lib/db";
import { getMpesaEnvConfig } from "@/lib/mpesa-env";
import { requireShop } from "@/lib/rbac";
import { getEtimsCheckoutAvailability } from "@/services/etims/etims-service";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const user = await requireShop();
  const business = await db.business.findUniqueOrThrow({
    where: { id: user.businessId },
    select: { posBarcodeScanningEnabled: true },
  });
  const shop = await db.shop.findUniqueOrThrow({
    where: { id: user.shopId },
    select: {
      id: true,
      name: true,
    },
  });
  const openRegisterSession = await db.registerSession.findFirst({
    where: { shopId: user.shopId, status: "OPEN" },
    select: { id: true },
    orderBy: { openedAt: "desc" },
  });

  if (!openRegisterSession) {
    redirect("/shop/register?error=" + encodeURIComponent("Open a register session before using the POS."));
  }

  const [envConfig, etimsCheckout] = await Promise.all([
    Promise.resolve(getMpesaEnvConfig()),
    getEtimsCheckoutAvailability({ businessId: user.businessId, shopId: user.shopId, role: user.role }), 
  ]);

  return <PosShell
    barcodeScanningEnabled={Boolean(business.posBarcodeScanningEnabled)}
    mpesaEnabled={envConfig.enabled}
    mpesaStkEnabled={envConfig.stkEnabled}
    mpesaPayToTillEnabled={envConfig.payToTillEnabled}
    mpesaTillNumber={envConfig.tillNumber}
    shopName={shop.name}
    registerSessionId={openRegisterSession?.id ?? null}
    canReprintReceipts={true}
    etimsCheckout={etimsCheckout}
  />;
}
