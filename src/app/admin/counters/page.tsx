import { requireAdmin } from "@/lib/rbac";
import { getCountersByShop } from "@/services/admin/counter-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { db } from "@/lib/db";
import { CounterCreateForm } from "@/components/admin/counter-create-form";
import { CounterCard } from "@/components/admin/counter-card";

export const dynamic = "force-dynamic";

export default async function CountersPage() {
  const user = await requireAdmin();

  // Get all shops for this business
  const shops = await db.shop.findMany({
    where: { businessId: user.businessId, isActive: true },
    orderBy: { name: "asc" },
  });

  // Fetch all counters for all shops
  const shopCounters = await Promise.all(
    shops.map(async (shop) => ({
      shop,
      counters: await getCountersByShop(shop.id),
    }))
  );

  return (
    <>
      <PageHeading 
        title="Physical counters" 
        description="Manage point-of-sale terminals and counters across your shops. Each counter operates independently with its own register sessions." 
      />

      <div className="space-y-6">
        {shops.length === 0 ? (
          <EmptyState title="No shops configured" description="Create a shop first before adding counters." />
        ) : (
          shopCounters.map(({ shop, counters }) => (
            <Card key={shop.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{shop.name}</h3>
                    <p className="text-sm text-slate-500">{counters.length} counter{counters.length === 1 ? "" : "s"} configured</p>
                  </div>
                  <CounterCreateForm shopId={shop.id} />
                </div>
              </CardHeader>

              <CardContent>
                {counters.length === 0 ? (
                  <EmptyState 
                    title="No counters configured" 
                    description="Create a counter to enable register operations at this shop." 
                  />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {counters.map((counter) => <CounterCard key={counter.id} counter={counter} />)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
