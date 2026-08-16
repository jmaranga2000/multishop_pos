import { db } from "@/lib/db";
import { queueAutomaticSupplierRestockRequests } from "@/services/admin/supplier-service";

export async function processSupplierRestockSweep() {
  const suppliers = await db.supplier.findMany({
    where: { status: "ACTIVE" },
    include: { shop: true, supplierProducts: true },
  });
  const administratorByBusiness = new Map<string, { id: string } | null>();
  let scanned = 0;
  let queued = 0;

  for (const supplier of suppliers) {
    if (!supplier.email?.trim() || !supplier.supplierProducts.length || !supplier.shop) continue;
    scanned += 1;
    let administrator = administratorByBusiness.get(supplier.businessId);
    if (administrator === undefined) {
      administrator = await db.user.findFirst({
        where: { businessId: supplier.businessId, role: "ADMIN", status: "ACTIVE" },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      administratorByBusiness.set(supplier.businessId, administrator ?? null);
    }
    if (!administrator) continue;

    queued += await queueAutomaticSupplierRestockRequests(db, {
      businessId: supplier.businessId,
      shopId: supplier.shopId,
      productId: supplier.supplierProducts[0].productId,
      userId: administrator.id,
      shopName: supplier.shop.name,
    });
  }

  return { scanned, queued };
}