import { Building2, Clock3, Mail, MapPin, ShieldCheck } from "lucide-react";
import { requireShop } from "@/lib/rbac";
import { getShopProfile } from "@/services/shop/profile-service";
import { PageHeading } from "@/components/ui/page-heading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireShop();
  const profile = await getShopProfile(user.id, user.shopId);
  return <><PageHeading title="Shop profile" description="The administrator controls credentials and shop assignment." /><div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><div className="flex items-center gap-3"><div className="rounded-2xl bg-blue-50 p-3 text-blue-700"><Building2 className="h-6 w-6" /></div><div><h2 className="font-extrabold">{profile.shop?.name}</h2><p className="text-sm text-slate-500">{profile.shop?.code}</p></div></div><Badge tone={profile.shop?.isActive ? "success" : "danger"}>{profile.shop?.isActive ? "Active" : "Inactive"}</Badge></CardHeader><CardContent className="space-y-4"><div className="flex items-start gap-3"><Mail className="mt-0.5 h-5 w-5 text-slate-400" /><div><p className="text-xs font-semibold uppercase text-slate-500">Login email</p><p className="font-semibold">{profile.email}</p></div></div><div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 text-slate-400" /><div><p className="text-xs font-semibold uppercase text-slate-500">Address</p><p className="font-semibold">{profile.shop?.address ?? "Not configured"}</p></div></div></CardContent></Card><Card><CardHeader><h2 className="font-extrabold">Account security</h2><ShieldCheck className="h-5 w-5 text-emerald-600" /></CardHeader><CardContent className="space-y-4"><div><p className="text-xs font-semibold uppercase text-slate-500">Account status</p><p className="mt-1 font-bold">{profile.status}</p></div><div className="flex items-start gap-3"><Clock3 className="mt-0.5 h-5 w-5 text-slate-400" /><div><p className="text-xs font-semibold uppercase text-slate-500">Last login</p><p className="font-semibold">{profile.lastLoginAt?.toLocaleString("en-KE") ?? "No recorded login"}</p></div></div><p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Password changes and password resets must be performed by the administrator.</p></CardContent></Card></div></>;
}
