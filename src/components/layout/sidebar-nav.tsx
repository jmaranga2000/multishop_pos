"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function SidebarNav({ items }: { items: { href: string; label: string; icon: LucideIcon }[] }) {
  const pathname = usePathname();
  return <nav className="mt-7 space-y-1">{items.map((item) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = item.icon;
    return <Link key={item.href} href={item.href} className={cn("nav-link", active && "active")}><Icon className="h-[18px] w-[18px]" /><span>{item.label}</span></Link>;
  })}</nav>;
}
