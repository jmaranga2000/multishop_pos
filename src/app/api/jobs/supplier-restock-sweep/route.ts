import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from "next/server";
import { getQStashVerificationUrl } from "@/lib/qstash";
import { processSupplierRestockSweep } from "@/services/jobs/supplier-restock-sweep-service";

export const runtime = "nodejs";

async function handler() {
  try {
    return NextResponse.json(await processSupplierRestockSweep());
  } catch (error) {
    console.error("QStash supplier restock sweep failed:", error);
    return NextResponse.json({ error: "Supplier restock sweep failed." }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler, {
  url: getQStashVerificationUrl("/api/jobs/supplier-restock-sweep"),
});