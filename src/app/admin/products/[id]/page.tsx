import { Package } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { getAdminProductById, getProductManagementData } from "@/services/admin/product-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProductEditForm } from "@/components/admin/product-edit-form";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProductDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const [product, { business, categories, brands, units }] = await Promise.all([
    getAdminProductById(user.businessId, id),
    getProductManagementData(user.businessId),
  ]);

  if (!product) return <p className="p-6">Product not found.</p>;

  return (
    <>
      <PageHeading title={product.name} description={`SKU: ${product.sku}`} />
      <div className="grid gap-5">
        <Card>
          <CardHeader><h2 className="font-extrabold">Details</h2></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-700"><Package className="h-6 w-6" /></div>
              <div>
                <p className="font-bold text-lg">{product.name} <Badge tone={product.status === "ACTIVE" ? "success" : "neutral"} className="ml-2">{product.status}</Badge></p>
                <p className="text-sm text-slate-500">{product.category?.name ?? "Uncategorized"} • {product.brand?.name ?? "Unbranded"} • {product.unit?.symbol ?? "unit"}</p>
                <p className="mt-2 text-sm">Barcode: {product.barcode ?? "None"}</p>
                <p className="text-sm">Cost: {formatMoney(product.defaultCostPrice.toString(), business.currency)}</p>
                <p className="text-sm">Price: {formatMoney(product.defaultSellingPrice.toString(), business.currency)}</p>
                <p className="text-sm">Inventory: {product._count.inventory} stock records</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h2 className="font-extrabold">Edit product</h2></CardHeader>
          <CardContent>
            <ProductEditForm product={product} categories={categories} brands={brands} units={units} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
