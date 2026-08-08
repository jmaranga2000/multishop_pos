import dotenv from "dotenv";
import path from "path";
import { db } from "../src/lib/db";
import { generateSupplierRestockRequest } from "../src/services/admin/supplier-service";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const supplierId = "72981888-75c1-4749-b545-e0ee319197f6";
  const productId = "7e459569-4782-4471-8e65-f3766e0b12e6"; // Ajab Premium Maize Floor 2KG
  const targetQuantity = 20;

  const supplierProduct = await db.supplierProduct.findFirst({ where: { supplierId, productId } });
  if (!supplierProduct) throw new Error("Supplier product not found");

  await db.supplierProduct.update({ where: { id: supplierProduct.id }, data: { targetQuantity } });
  console.log("Updated supplier product target quantity", supplierProduct.id, "->", targetQuantity);

  const admin = await db.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("No admin user found");

  const history = await generateSupplierRestockRequest({ id: admin.id, businessId: admin.businessId }, supplierId);
  console.log("Generated supplier restock request:", history);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
