import { notFound } from "next/navigation";
import { verifyReceiptShareToken } from "@/lib/receipt-share-token";
import { db } from "@/lib/db";
import type { ThermalReceiptData } from "@/components/shop/thermal-receipt";
import { ReceiptViewer } from "./receipt-viewer";

export const dynamic = "force-dynamic";

export default async function SharedReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const storedShare = await db.receiptShare.findFirst({ where: { token, expiresAt: { gt: new Date() } } });
  const receipt = (storedShare?.receipt as ThermalReceiptData | undefined) ?? verifyReceiptShareToken(token);
  if (!receipt) notFound();
  return <ReceiptViewer receipt={receipt} />;
}
