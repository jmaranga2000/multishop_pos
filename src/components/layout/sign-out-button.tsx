"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const router = useRouter();

  return <button onClick={async () => {
    indexedDB.deleteDatabase("multishop-pos-offline");
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }} className="nav-link mt-2 w-full"><LogOut className="h-[18px] w-[18px]" />Sign out</button>;
}
