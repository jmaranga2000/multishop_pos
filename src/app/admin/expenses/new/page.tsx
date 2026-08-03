import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { createExpenseCategoryAction } from "@/actions/admin/expense-actions";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default async function NewExpenseTypePage() {
  await requireAdmin();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeading
          title="New expense type"
          description="Create a new category that shops can select when recording expenses."
        />
        <Button href="/admin/expenses" size="sm" variant="ghost">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-extrabold">Expense category</h2>
        </CardHeader>
        <CardContent>
          <form action={createExpenseCategoryAction} className="space-y-4">
            <Input name="name" placeholder="e.g. Office Supplies" required />
            <Button type="submit" variant="secondary">
              Create expense type
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
