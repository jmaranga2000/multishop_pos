"use client";

import { Area, AreaChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/utils";

type DailySale = { label: string; sales: number; transactions: number };
type PaymentBreakdown = { CASH: number; MPESA: number; CARD: number; BANK_TRANSFER: number; MIXED: number };

const PAYMENT_COLORS: Record<keyof PaymentBreakdown, string> = {
  CASH: "#2563eb",
  MPESA: "#059669",
  CARD: "#7c3aed",
  BANK_TRANSFER: "#d97706",
  MIXED: "#64748b",
};

export function EmployeePerformanceVisuals({ currency, dailySales, payments }: { currency: string; dailySales: DailySale[]; payments: PaymentBreakdown }) {
  const paymentData = (Object.entries(payments) as [keyof PaymentBreakdown, number][])
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name: name.replaceAll("_", " "), value, fill: PAYMENT_COLORS[name] }));

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="min-w-0 rounded-xl border border-slate-200 p-4">
        <div className="mb-3"><h3 className="font-bold">Daily sales</h3><p className="text-sm text-slate-500">Gross sales recorded during the selected period.</p></div>
        {dailySales.some((point) => point.sales > 0) ? <div className="h-72 min-w-0"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}><AreaChart data={dailySales} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><defs><linearGradient id="employee-sales-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} /><stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} minTickGap={18} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} width={58} /><Tooltip formatter={(value) => formatMoney(Number(value), currency)} /><Area type="monotone" dataKey="sales" name="Sales" stroke="#2563eb" strokeWidth={3} fill="url(#employee-sales-fill)" /></AreaChart></ResponsiveContainer></div> : <div className="flex h-72 items-center justify-center text-sm text-slate-500">No settled sales in this period.</div>}
      </section>
      <section className="min-w-0 rounded-xl border border-slate-200 p-4">
        <div className="mb-3"><h3 className="font-bold">Payment mix</h3><p className="text-sm text-slate-500">Verified and pending non-failed payments by method.</p></div>
        {paymentData.length ? <div className="h-72 min-w-0"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}><PieChart><Pie data={paymentData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={94} paddingAngle={3}>{paymentData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}</Pie><Tooltip formatter={(value) => formatMoney(Number(value), currency)} /><Legend /></PieChart></ResponsiveContainer></div> : <div className="flex h-72 items-center justify-center text-sm text-slate-500">No payments recorded in this period.</div>}
      </section>
    </div>
  );
}