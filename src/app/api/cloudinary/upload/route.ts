import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
const folder = process.env.CLOUDINARY_FOLDER;

function buildSignature(timestamp: string) {
  const params = [`timestamp=${timestamp}`];
  if (folder) params.push(`folder=${folder}`);
  const toSign = params.sort().join("&") + apiSecret;
  return createHash("sha1").update(toSign).digest("hex");
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
  const signature = buildSignature(timestamp);

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
    return NextResponse.json({ error: result.error?.message ?? "Cloudinary upload failed." }, { status: 500 });
  }

  return NextResponse.json(result);
}
