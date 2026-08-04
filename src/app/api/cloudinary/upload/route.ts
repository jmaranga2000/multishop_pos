import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

function normalizeEnvValue(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
}

const cloudName = normalizeEnvValue(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);
const apiKey = normalizeEnvValue(process.env.CLOUDINARY_API_KEY);
const apiSecret = normalizeEnvValue(process.env.CLOUDINARY_API_SECRET);
const folder = normalizeEnvValue(process.env.CLOUDINARY_FOLDER);
const debugSignature = normalizeEnvValue(process.env.CLOUDINARY_DEBUG_SIGNATURE) === "true";

function buildSignature(timestamp: string) {
  const params = { timestamp, ...(folder ? { folder } : {}) };
  const stringToSign = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const signature = createHash("sha1").update(stringToSign + apiSecret).digest("hex");
  return { signature, stringToSign };
}

export async function POST(request: Request) {
  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: "Cloudinary is not configured on the server." }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file was provided." }, { status: 400 });
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const { signature, stringToSign } = buildSignature(timestamp);

  const uploadData = new FormData();
  uploadData.append("file", file);
  uploadData.append("api_key", apiKey);
  uploadData.append("timestamp", timestamp);
  uploadData.append("signature", signature);
  if (folder) {
    uploadData.append("folder", folder);
  }

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: uploadData,
  });

  const result = await response.json();
  if (!response.ok) {
    const errorPayload: Record<string, unknown> = {
      error: result.error?.message ?? "Cloudinary upload failed.",
    };
    if (debugSignature) {
      errorPayload.stringToSign = stringToSign;
      errorPayload.timestamp = timestamp;
      if (folder) errorPayload.folder = folder;
    }
    return NextResponse.json(errorPayload, { status: 500 });
  }

  return NextResponse.json(result);
}
