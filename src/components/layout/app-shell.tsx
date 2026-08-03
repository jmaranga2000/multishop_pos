"use client";

import { Bell, Store, Menu } from "lucide-react";
import { useState } from "react";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { Button } from "@/components/ui/button";

export function AppShell({ children, navItems, userName, userEmail, accountLabel, notificationCount = 0, headerExtra }: {
  children: React.ReactNode;
  navItems: { href: string; label: string; icon: string; count?: number; countTone?: "danger" | "warning" | "success" }[];
  userName: string;
  userEmail?: string;
  accountLabel: string;
  notificationCount?: number;
  headerExtra?: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  const handleToggle = () => {
    if (typeof window !== "undefined" && window.innerWidth <= 900) {
      setMobileOpen((s) => !s);
    } else {
      setCollapsed((s) => !s);
    }
  };

  return <div className={`app-grid ${collapsed ? "sidebar-collapsed" : ""}`}>
    <aside className={`app-sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="flex items-center gap-3 px-2"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-950/30"><Store className="h-6 w-6" /></div><div className="min-w-0"><p className="font-extrabold text-white">MultiShop POS</p><p className="text-xs text-blue-200">Offline-first retail</p></div></div>
      <SidebarNav items={navItems} collapsed={collapsed} />
      <div className="mt-8 border-t border-white/10 pt-4"><div className="rounded-xl bg-white/5 px-3 py-3"><p className="truncate text-sm font-bold text-white">{userName}</p><p className="truncate text-xs text-blue-200">{accountLabel}</p></div><SignOutButton /></div>
    </aside>
    <div className="app-main">
      <header className="app-header flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" aria-label="Toggle menu" onClick={handleToggle} className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600"><Menu className="h-5 w-5" /></button>
          {headerExtra ? <div>{headerExtra}</div> : null}
        </div>
        <div className="hidden min-w-0 flex-1 items-center justify-center text-center md:flex">
          <div>
            <p className="text-sm font-bold text-slate-900">{userName}</p>
            {userEmail && <p className="text-xs text-slate-500">{userEmail}</p>}
          </div>
        </div>
        <div className="relative flex items-center gap-3">
          <button type="button" aria-label="Notifications" aria-expanded={notificationOpen} onClick={() => setNotificationOpen((open) => !open)} className="relative inline-flex h-10 w-10 items-center justify-center overflow-visible rounded-xl border border-slate-200 bg-white text-slate-800 transition hover:bg-slate-50">
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{notificationCount > 99 ? "99+" : notificationCount}</span>}
          </button>
          {notificationOpen && (
            <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/10">
              <p className="text-sm font-bold text-slate-900">Notifications</p>
              <p className="mt-1 text-xs text-slate-500">{notificationCount > 0 ? `${notificationCount} unread notifications` : "No unread notifications"}</p>
              <Button href="/admin/notifications" variant="primary" size="sm" className="mt-3 w-full" onClick={() => setNotificationOpen(false)}>
                Open notifications
              </Button>
            </div>
          )}
          <div className="hidden text-right sm:block"><p className="text-sm font-bold text-slate-900">{userName}</p><p className="text-xs text-slate-500">{accountLabel}</p></div>
        </div>
      </header>
      {mobileOpen && <div className="fixed inset-0 z-40">
        <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
        <aside className="absolute left-0 top-0 h-full w-64 overflow-y-auto bg-[#0b1739] p-6">
          <div className="flex items-center gap-3 mb-4"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500 text-white"><Store className="h-6 w-6" /></div><div><p className="font-extrabold text-white">MultiShop POS</p><p className="text-xs text-blue-200">{accountLabel}</p></div></div>
          <SidebarNav items={navItems} />
          <div className="mt-6"><SignOutButton /></div>
        </aside>
      </div>}
      <main className="app-content">{children}</main>
    </div>
  </div>;
}
