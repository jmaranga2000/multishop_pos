import { requireAdmin } from "@/lib/rbac";
import { getSupplierManagementDetails, listSupplierProductsForBusiness } from "@/services/admin/supplier-service";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardHeader } from "@/components/ui/card";
import { SupplierEditForm } from "@/components/admin/supplier-edit-form";

export const dynamic = "force-dynamic";

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: supplierId } = await params;
  const admin = await requireAdmin();

  const details = await getSupplierManagementDetails(admin.businessId, supplierId);
  if (!details) notFound();

  const { supplier } = details;

  const [shops, products] = await Promise.all([
    db.shop.findMany({
      where: { businessId: admin.businessId },
      orderBy: { name: "asc" },
    }),
    listSupplierProductsForBusiness(admin.businessId),
  ]);

  return (
    <>
      <PageHeading title={supplier.name} description={supplier.company} />
      <div className="grid gap-5">
        <Card>
          <CardHeader>
            <h2 className="font-extrabold">Supplier details</h2>
          </CardHeader>
          <div className="p-6">
            <SupplierEditForm
              supplier={supplier}
              shops={shops}
              products={products}
              selectedProductIds={supplier.supplierProducts.map((entry: { productId: string }) => entry.productId)}
            />
          </div>
        </Card>
      </div>
    </>
  );
}
