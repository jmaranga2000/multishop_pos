import Link from "next/link";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { updateExpenseCategoryAction } from "@/actions/admin/expense-actions";
import { getExpenseCategoryById } from "@/services/admin/expense-service";
import { formatMoney } from "@/lib/utils";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ExpenseTypeDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const category = await getExpenseCategoryById(user.businessId, id);

  if (!category) {
    notFound();
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeading
          title={category.name}
          description="Manage the expense category and review recent submissions for it."
        />
        <Button as={Link} href="/admin/expenses" size="sm" variant="ghost">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-extrabold">Edit expense type</h2>
              <p className="text-sm text-slate-500">Changes apply to the options shown in the shop portal.</p>
            </div>
            <Badge tone={category.isActive ? "success" : "warning"}>
              {category.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form action={updateExpenseCategoryAction} className="space-y-4">
            <input type="hidden" name="id" value={category.id} />
            <Input name="name" defaultValue={category.name} required />
            <Button type="submit" variant="secondary">
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <CardHeader>
          <h2 className="font-extrabold">Recent expenses</h2>
        </CardHeader>
        {category.expenses.length ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Shop</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {category.expenses.map((expense: { id: string; shop?: { name?: string | null } | null; description: string; amount: number; occurredAt: Date }) => (
                  <tr key={expense.id}>
                    <td>{expense.shop?.name ?? "Unknown shop"}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <ReceiptText className="h-4 w-4 text-slate-400" />
                        {expense.description}
                      </div>
                    </td>
                    <td>{formatMoney(expense.amount.toString(), user.businessId)}</td>
                    <td>{expense.occurredAt.toLocaleDateString("en-KE")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No submissions yet" description="Shop expense submissions for this type will appear here." />
        )}
      </Card>
    </>
  );
}
