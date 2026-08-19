import { Check, Plus, ReceiptText, X } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { reviewExpenseAction, toggleExpenseCategoryAction } from "@/actions/admin/expense-actions";
import { getAdminExpensePageData } from "@/services/admin/expense-service";
import { formatMoney } from "@/lib/utils";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const user = await requireAdmin();
  const { business, categories, expenses } = await getAdminExpensePageData(user.businessId);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeading
          title="Expense types"
          description="Create the expense categories that shops can select when recording expenses."
        />
        <a href="/admin/expenses/new" className="inline-flex h-9 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-800">
          <Plus className="h-4 w-4" />New expense type
        </a>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-extrabold">Expense categories</h2>
              <p className="text-sm text-slate-500">These options appear in the shop portal expense form.</p>
            </div>
          </div>
        </CardHeader>

        {categories.length ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <ReceiptText className="h-4 w-4 text-slate-400" />
                        <span className="font-semibold">{category.name}</span>
                      </div>
                    </td>
                    <td>
                      <Badge tone={category.isActive ? "success" : "warning"}>
                        {category.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Button href={`/admin/expenses/${category.id}`} size="sm" variant="secondary">
                          View
                        </Button>
                        <form action={toggleExpenseCategoryAction}>
                          <input type="hidden" name="categoryId" value={category.id} />
                          <input type="hidden" name="isActive" value={category.isActive ? "false" : "true"} />
                          <Button type="submit" size="sm" variant={category.isActive ? "danger" : "success"}>
                            {category.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No expense types yet" description="Create the first expense category for shop users to select." />
        )}
      </Card>

      <Card className="mt-6 overflow-hidden">
        <CardHeader>
          <h2 className="font-extrabold">Pending expense approvals</h2>
        </CardHeader>
        {expenses.length ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Shop</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Source</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{expense.shop.name}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <ReceiptText className="h-4 w-4 text-slate-400" />
                        {expense.category.name}
                      </div>
                    </td>
                    <td className="max-w-sm">{expense.description}</td>
                    <td><Badge tone={expense.source === "MPESA" ? "info" : "neutral"}>{expense.source}</Badge></td>
                    <td className="font-bold">{formatMoney(expense.amount.toString(), business.currency)}</td>
                    <td>{expense.occurredAt.toLocaleDateString("en-KE")}</td>
                    <td>
                      <Badge tone={expense.status === "APPROVED" ? "success" : expense.status === "REJECTED" ? "danger" : "warning"}>
                        {expense.status}
                      </Badge>
                    </td>
                    <td>
                      {expense.status === "PENDING" ? (
                        <div className="flex gap-2">
                          <form action={reviewExpenseAction}>
                            <input type="hidden" name="expenseId" value={expense.id} />
                            <input type="hidden" name="decision" value="APPROVED" />
                            <Button size="sm" variant="success">
                              <Check className="h-4 w-4" />Approve
                            </Button>
                          </form>
                          <form action={reviewExpenseAction}>
                            <input type="hidden" name="expenseId" value={expense.id} />
                            <input type="hidden" name="decision" value="REJECTED" />
                            <Button size="sm" variant="danger">
                              <X className="h-4 w-4" />Reject
                            </Button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Reviewed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No expenses" description="Shop-submitted expenses will appear here." />
        )}
      </Card>
    </>
  );
}
