import crypto from "crypto";
import type { ThermalReceiptData } from "@/components/shop/thermal-receipt";

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const RECEIPT_SHARE_SECRET = process.env.AUTH_SECRET as string;

type ReceiptSharePayload = {
  receipt: ThermalReceiptData;
  expiresAt: number;
};

function sign(value: string) {
  return crypto.createHmac("sha256", RECEIPT_SHARE_SECRET).update(value).digest("base64url");
}

export function createReceiptShareToken(receipt: ThermalReceiptData) {
  const payload: ReceiptSharePayload = {
    receipt,
    expiresAt: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyReceiptShareToken(token: string): ThermalReceiptData | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || sign(encoded) !== signature) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ReceiptSharePayload;
    if (!payload.expiresAt || payload.expiresAt < Math.floor(Date.now() / 1000) || !payload.receipt?.receiptNumber) return null;
    return payload.receipt;
  } catch {
    return null;
  }
}
