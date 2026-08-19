import { notFound } from "next/navigation";
import { verifyReceiptShareToken } from "@/lib/receipt-share-token";
import { ReceiptViewer } from "./receipt-viewer";

export const dynamic = "force-dynamic";

export default async function SharedReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const receipt = verifyReceiptShareToken(token);
  if (!receipt) notFound();
  return <ReceiptViewer receipt={receipt} />;
}
