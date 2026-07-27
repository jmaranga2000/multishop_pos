import { Plus, ReceiptText } from "lucide-react";
import { requireShop } from "@/lib/rbac";
import { createExpenseAction } from "@/actions/shop/expense-actions";
import { getShopExpenseData } from "@/services/shop/expense-service";
import { formatMoney } from "@/lib/utils";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const user = await requireShop();
  const { business, categories, expenses } = await getShopExpenseData(user.shopId, user.businessId);
  return <><PageHeading title="Shop expenses" description="Record operational expenses for administrator review." /><div className="grid gap-5 xl:grid-cols-[1fr_360px]"><Card className="overflow-hidden"><CardHeader><h2 className="font-extrabold">Expense history</h2></CardHeader>{expenses.length ? <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Category</th><th>Description</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead><tbody>{expenses.map((expense) => <tr key={expense.id}><td><div className="flex items-center gap-2"><ReceiptText className="h-4 w-4 text-slate-400" />{expense.category.name}</div></td><td>{expense.description}</td><td className="font-bold">{formatMoney(expense.amount.toString(), business.currency)}</td><td>{expense.occurredAt.toLocaleDateString("en-KE")}</td><td><Badge tone={expense.status === "APPROVED" ? "success" : expense.status === "REJECTED" ? "danger" : "warning"}>{expense.status}</Badge></td></tr>)}</tbody></table></div> : <EmptyState title="No expenses recorded" description="Use the form to submit an expense." />}</Card><Card><CardHeader><div><h2 className="font-extrabold">Record expense</h2><p className="text-sm text-slate-500">New entries remain pending until approved.</p></div></CardHeader><CardContent>{categories.length ? <form action={createExpenseAction} className="space-y-3"><select name="categoryId" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><Input name="amount" type="number" min="0.01" step="0.01" placeholder="Amount" required /><Input name="occurredAt" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} required /><textarea name="description" placeholder="What was this expense for?" className="min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm" required /><Button className="w-full"><Plus className="h-4 w-4" />Submit expense</Button></form> : <EmptyState title="No expense categories" description="Ask the administrator to create expense categories through the seed or database configuration." />}</CardContent></Card></div></>;
}
