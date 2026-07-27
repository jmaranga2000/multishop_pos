"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LockKeyhole, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const body = await response.json();
    setLoading(false);

    if (!response.ok || body.error) {
      setError(body.error || "Invalid credentials, suspended account, or temporarily locked login.");
      return;
    }

    router.push(params.get("callbackUrl") || "/");
  }

  return <form onSubmit={submit} className="space-y-4">
    <div><label className="mb-1.5 block text-sm font-semibold text-slate-700">Email address</label><div className="relative"><Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" placeholder="shop@example.com" required /></div></div>
    <div><label className="mb-1.5 block text-sm font-semibold text-slate-700">Password</label><div className="relative"><LockKeyhole className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" placeholder="Enter password" required /></div></div>
    {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    <Button className="w-full" size="lg" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}{loading ? "Signing in..." : "Sign in securely"}</Button>
    <p className="text-center text-xs text-slate-500">Shop accounts are created and managed only by the administrator.</p>
  </form>;
}
