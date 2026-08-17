"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import * as Icons from "lucide-react";

type SidebarNavItem = {
  href: string;
  label: string;
  icon: string;
  count?: number;
  countTone?: "danger" | "warning" | "success";
};

type SidebarNavProps = {
  items: SidebarNavItem[];
  collapsed?: boolean;
  onNavigate?: () => void;
};

export function SidebarNav({ items, collapsed = false, onNavigate }: SidebarNavProps) {
  const pathname = usePathname() ?? "";

  return (
    <nav className="mt-7 space-y-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[item.icon];
        const count = item.count ?? 0;
        const badgeTone = item.countTone === "success"
          ? "bg-emerald-600 text-white"
          : item.countTone === "warning"
            ? "bg-amber-500 text-white"
            : "bg-red-500 text-white";

        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            aria-label={item.label}
            className={active ? "nav-link relative active" : "nav-link relative"}
            onClick={onNavigate}
          >
            {Icon ? <Icon className="h-[18px] w-[18px]" /> : <span className="inline-block h-[18px] w-[18px]" />}
            {!collapsed && <span>{item.label}</span>}
            {count > 0 && (
              <span
                className={cn(
                  "absolute inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                  collapsed ? "-right-2 top-0 min-w-[18px] py-0.5" : "right-3 top-1",
                  badgeTone,
                )}
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
