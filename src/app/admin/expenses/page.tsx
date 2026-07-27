import { Check, ReceiptText, X } from "lucide-react";
import { requireAdmin } from "@/lib/rbac";
import { reviewExpenseAction } from "@/actions/admin/expense-actions";
import { getAdminExpensePageData } from "@/services/admin/expense-service";
import { formatMoney } from "@/lib/utils";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const user = await requireAdmin();
  const { expenses, business } = await getAdminExpensePageData(user.businessId);
  return <><PageHeading title="Expense approvals" description="Review shop-submitted expenses before they affect approved expense reporting." /><Card className="overflow-hidden"><CardHeader><h2 className="font-extrabold">Submitted expenses</h2></CardHeader>{expenses.length ? <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Shop</th><th>Category</th><th>Description</th><th>Amount</th><th>Date</th><th>Status</th><th>Decision</th></tr></thead><tbody>{expenses.map((expense) => <tr key={expense.id}><td>{expense.shop.name}</td><td><div className="flex items-center gap-2"><ReceiptText className="h-4 w-4 text-slate-400" />{expense.category.name}</div></td><td className="max-w-sm">{expense.description}</td><td className="font-bold">{formatMoney(expense.amount.toString(), business.currency)}</td><td>{expense.occurredAt.toLocaleDateString("en-KE")}</td><td><Badge tone={expense.status === "APPROVED" ? "success" : expense.status === "REJECTED" ? "danger" : "warning"}>{expense.status}</Badge></td><td>{expense.status === "PENDING" ? <div className="flex gap-2"><form action={reviewExpenseAction}><input type="hidden" name="expenseId" value={expense.id} /><input type="hidden" name="decision" value="APPROVED" /><Button size="sm" variant="success"><Check className="h-4 w-4" />Approve</Button></form><form action={reviewExpenseAction}><input type="hidden" name="expenseId" value={expense.id} /><input type="hidden" name="decision" value="REJECTED" /><Button size="sm" variant="danger"><X className="h-4 w-4" />Reject</Button></form></div> : <span className="text-xs text-slate-500">Reviewed</span>}</td></tr>)}</tbody></table></div> : <EmptyState title="No expenses" description="Shop-submitted expenses will appear here." />}</Card></>;
}
