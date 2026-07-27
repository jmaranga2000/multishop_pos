"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/utils";
export function SalesChart({ data }: { data: { label: string; sales: number }[] }) {
  if (!data.length) return <div className="flex h-72 items-center justify-center text-sm text-slate-400">No sales recorded for this period.</div>;
  return <div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3265df" stopOpacity={0.35}/><stop offset="95%" stopColor="#3265df" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e4e7ec"/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize:12,fill:"#667085"}}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:12,fill:"#667085"}}/><Tooltip formatter={(value)=>formatMoney(Number(value))}/><Area type="monotone" dataKey="sales" stroke="#3265df" strokeWidth={3} fill="url(#salesFill)"/></AreaChart></ResponsiveContainer></div>;
}
