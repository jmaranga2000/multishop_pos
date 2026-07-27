import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({ label, value, helper, icon, tone = "blue" }: { label: string; value: string; helper?: string; icon: React.ReactNode; tone?: "blue" | "green" | "amber" | "red" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  return <Card className="p-5">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">{value}</p>{helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}</div>
      <div className={cn("rounded-xl p-2.5", tones[tone])}>{icon}</div>
    </div>
  </Card>;
}
