import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";
import { db } from "../src/lib/db";
import { generateSupplierRestockRequest } from "../src/services/admin/supplier-service";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const admin = await db.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("No admin user found");

  const supplierId = "72981888-75c1-4749-b545-e0ee319197f6";
  const result = await generateSupplierRestockRequest(
    { id: admin.id, businessId: admin.businessId },
    supplierId,
  );

  console.log("generated restock request", result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
