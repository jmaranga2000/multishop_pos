"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const router = useRouter();

  return <button title="Sign out" onClick={async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }} className="nav-link mt-2 w-full"><LogOut className="h-[18px] w-[18px]" /><span className="ml-2">Sign out</span></button>;
}
