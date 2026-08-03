import Link from "next/link";
import { requireAdmin } from "@/lib/rbac";
import { addStockAction } from "@/actions/admin/inventory-actions";
import { getInventoryManagementData } from "@/services/admin/inventory-service";
import { StockMovementForm } from "@/components/admin/stock-movement-form";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function NewInventoryPage() {
  const user = await requireAdmin();
  const { shops, products } = await getInventoryManagementData(user.businessId);

  return (
    <>
      <PageHeading title="Create stock movement" description="Add inventory for a product and shop combination." />
      <div className="mb-4">
        <Link href="/admin/inventory" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Back to list
        </Link>
      </div>
      <Card>
        <CardHeader>
          <div>
            <h2 className="font-extrabold">New stock movement</h2>
            <p className="text-sm text-slate-500">Creates a ledger entry and refreshes stock alerts.</p>
          </div>
        </CardHeader>
        <CardContent>
          <StockMovementForm shops={shops} products={products} action={addStockAction} />
        </CardContent>
      </Card>
    </>
  );
}
