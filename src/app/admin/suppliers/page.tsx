import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { listSuppliers } from "@/services/admin/supplier-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const admin = await requireAdmin();
  const suppliers = await listSuppliers(admin.businessId);

  return (
    <>
      <PageHeading title="Suppliers" description="Manage suppliers and configure restock requests." />
      <div className="flex justify-end mb-4">
        <Link href="/admin/suppliers/new" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">New supplier</Link>
      </div>
      <div className="grid gap-5">
        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <h2 className="font-extrabold">All suppliers</h2>
              <p className="text-sm text-slate-500">Track suppliers and their assigned products for automatic restock notifications.</p>
            </div>
          </CardHeader>
          {suppliers.length ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Company</th><th>Shop</th><th>Contact</th><th>Products</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl bg-purple-50 p-2 text-purple-700"><PackageCheck className="h-4 w-4" /></div>
                          <div><p className="font-bold">{supplier.name}</p></div>
                        </div>
                      </td>
                      <td><p className="text-sm">{supplier.company}</p></td>
                      <td><p className="text-sm">{supplier.shop?.name ?? "Unknown"}</p></td>
                      <td>
                        <div className="text-sm">
                          <p>{supplier.email}</p>
                          <p className="text-xs text-slate-500">{supplier.phone}</p>
                        </div>
                      </td>
                      <td>{supplier._count?.supplierProducts ?? 0} products</td>
                      <td><Badge tone={supplier.status === "ACTIVE" ? "success" : "danger"}>{supplier.status}</Badge></td>
                      <td>
                        <div className="flex gap-2">
                          <a href={`/admin/suppliers/${supplier.id}`} className="inline-flex items-center rounded-lg border px-3 py-2 text-sm">View</a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title="No suppliers yet" description="Create your first supplier to enable restock request notifications." />}
        </Card>
      </div>
    </>
  );
}
