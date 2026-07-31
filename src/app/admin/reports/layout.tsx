import Link from "next/link";
import { requireAdmin } from "@/lib/rbac";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminReportsLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button as={Link} href="/admin/reports" variant="secondary" size="sm">
          Overview
        </Button>
        <Button as={Link} href="/admin/reports/inventory" variant="secondary" size="sm">
          Weekly inventory
        </Button>
        <Button as={Link} href="/admin/reports/stock" variant="secondary" size="sm">
          Stock intelligence
        </Button>
        <Button as={Link} href="/admin/reports/daily" variant="secondary" size="sm">
          Daily snapshot
        </Button>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        Reports are generated from live stock and completed sales across all shops. Use the links above to review weekly inventory history, current stock risk, and today&apos;s central snapshot.
      </div>
      {children}
    </div>
  );
}
