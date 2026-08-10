import Link from "next/link";
import { Package } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { getAdminProductById, getProductManagementData } from "@/services/admin/product-service";
import { deleteProductAction } from "@/actions/admin/product-actions";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProductEditForm } from "@/components/admin/product-edit-form";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import { BarcodePrintPreview } from "@/components/admin/barcode-print-preview";

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
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/admin/products" className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium">
          Back to list
        </Link>
        <form action={deleteProductAction} className="inline">
          <input type="hidden" name="productId" value={product.id} />
          <Button type="submit" variant="danger" size="sm">
            Delete product
          </Button>
        </form>
      </div>
      <div className="grid gap-5">
        <Card>
          <CardHeader><h2 className="font-extrabold">Details</h2></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-24 w-24 overflow-hidden rounded-3xl bg-slate-100">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-blue-700"><Package className="h-6 w-6" /></div>
                )}
              </div>
              <div>
                <p className="font-bold text-lg">{product.name} <Badge tone={product.status === "ACTIVE" ? "success" : "neutral"} className="ml-2">{product.status}</Badge></p>
                <p className="text-sm text-slate-500">{product.category?.name ?? "Uncategorized"} • {product.brand?.name ?? "Unbranded"} • {product.unit?.symbol ?? "unit"}</p>
                <p className="mt-2 text-sm">Barcode: {product.barcode ?? "None"}</p>
                <p className="text-sm">Cost: {formatMoney(product.defaultCostPrice.toString(), business.currency)}</p>
                <p className="text-sm">Price: {formatMoney(product.defaultSellingPrice.toString(), business.currency)}</p>
                <p className="text-sm">Inventory: {product._count.inventory} stock records</p>
              </div>
            </div>
            {product.barcode ? (
              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <BarcodePrintPreview barcode={product.barcode} productName={product.name} sku={product.sku} />
              </div>
            ) : null}
                {product.pricingUnits?.length ? (
                  <div className="mt-4">
                    <h3 className="font-bold">Pricing options</h3>
                    <div className="mt-2 space-y-2">
                      {product.pricingUnits.map((p: { id: string; unitId: string; unit?: { name?: string | null; symbol?: string | null }; costPrice: number; sellingPrice: number }, idx: number) => (
                        <div key={p.id} className="flex items-center justify-between rounded-xl border p-3">
                          <div>
                            <p className="font-semibold">{p.unit?.name ?? p.unitId} {idx === 0 ? <span className="ml-2 text-xs text-slate-500">(default)</span> : null}</p>
                            <p className="text-xs text-slate-500">Cost: {formatMoney(p.costPrice.toString(), business.currency)} • Price: {formatMoney(p.sellingPrice.toString(), business.currency)} {p.unit?.symbol ? `• ${p.unit.symbol}` : ''}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
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
