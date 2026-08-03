import { requireAdmin } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PageHeading } from "@/components/ui/page-heading";
import { SupplierEditForm } from "@/components/admin/supplier-edit-form";
import { listSupplierProductsForBusiness } from "@/services/admin/supplier-service";

export const dynamic = "force-dynamic";

export default async function NewSupplierPage() {
  const admin = await requireAdmin();

  const [shops, products] = await Promise.all([
    db.shop.findMany({
      where: { businessId: admin.businessId },
      orderBy: { name: "asc" },
    }),
    listSupplierProductsForBusiness(admin.businessId),
  ]);

  return (
    <>
      <PageHeading title="New supplier" description="Create a new supplier and assign products." />
      <div className="grid gap-5">
        <SupplierEditForm shops={shops} products={products} />
      </div>
    </>
  );
}
