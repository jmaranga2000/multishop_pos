import { Bell, Store } from "lucide-react";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { SignOutButton } from "@/components/layout/sign-out-button";
import type { LucideIcon } from "lucide-react";

export function AppShell({ children, navItems, userName, accountLabel, notificationCount = 0, headerExtra }: {
  children: React.ReactNode;
  navItems: { href: string; label: string; icon: LucideIcon }[];
  userName: string;
  accountLabel: string;
  notificationCount?: number;
  headerExtra?: React.ReactNode;
}) {
  return <div className="app-grid">
    <aside className="app-sidebar">
      <div className="flex items-center gap-3 px-2"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-950/30"><Store className="h-6 w-6" /></div><div><p className="font-extrabold text-white">MultiShop POS</p><p className="text-xs text-blue-200">Offline-first retail</p></div></div>
      <SidebarNav items={navItems} />
      <div className="mt-8 border-t border-white/10 pt-4"><div className="rounded-xl bg-white/5 px-3 py-3"><p className="truncate text-sm font-bold text-white">{userName}</p><p className="truncate text-xs text-blue-200">{accountLabel}</p></div><SignOutButton /></div>
    </aside>
    <div className="app-main">
      <header className="app-header"><div>{headerExtra}</div><div className="flex items-center gap-3"><button className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600"><Bell className="h-5 w-5" />{notificationCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{notificationCount > 99 ? "99+" : notificationCount}</span>}</button><div className="hidden text-right sm:block"><p className="text-sm font-bold text-slate-900">{userName}</p><p className="text-xs text-slate-500">{accountLabel}</p></div></div></header>
      <main className="app-content">{children}</main>
    </div>
  </div>;
}
