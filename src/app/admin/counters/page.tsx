import { MoreVertical, AlertCircle } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { getCountersByShop } from "@/services/admin/counter-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { db } from "@/lib/db";
import { CounterCreateForm } from "@/components/admin/counter-create-form";

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
                    {counters.map((counter) => (
                      <div key={counter.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-bold">{counter.name}</h4>
                            <p className="text-sm text-slate-500">Code: {counter.code}</p>
                            {counter.description && (
                              <p className="mt-2 text-xs text-slate-600">{counter.description}</p>
                            )}
                          </div>
                          <Badge tone={counter.status === "ACTIVE" ? "success" : "neutral"}>
                            {counter.status}
                          </Badge>
                        </div>

                        {counter.deviceId && (
                          <div className="mt-3 rounded-lg bg-slate-50 px-2 py-1">
                            <p className="text-xs font-medium text-slate-600">Device: {counter.deviceId}</p>
                          </div>
                        )}

                        {counter.currentSession && (
                          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-amber-600" />
                              <div className="text-xs">
                                <p className="font-medium text-amber-900">Session active</p>
                                <p className="text-amber-800">
                                  {counter.currentSession.salesperson} on {counter.currentSession.register}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mt-4 flex items-center gap-2 border-t border-slate-200 pt-3">
                          <Button type="button" size="sm" variant="ghost" className="flex-1" disabled>
                            Edit
                          </Button>
                          <Button type="button" size="sm" variant="ghost" className="px-2" disabled aria-label="More counter actions">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
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
