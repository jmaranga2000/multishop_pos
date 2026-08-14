"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney, fromMinorUnits } from "@/lib/utils";

export default function AdminCustomersPage() {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/shop/customers?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error("Failed to fetch customers");
        const data = await res.json();
        if (!active) return;
        setCustomers(data);
      } catch (err) {
        console.error(err);
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [query]);

  return (
    <div className="p-6 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Customers (Admin)</h1>
          <div className="flex gap-2">
            <Link href="/admin/credit">
              <Button variant="secondary">Credit Dashboard</Button>
            </Link>
            <Link href="/admin/customers/new">
              <Button>Create Customer</Button>
            </Link>
          </div>
        </div>

        <Card className="p-4 mb-4">
          <div className="flex gap-2">
            <Input placeholder="Search customers" value={query} onChange={(e) => setQuery(e.target.value)} />
            <Button onClick={() => setQuery("")}>Clear</Button>
          </div>
        </Card>

        <div className="space-y-3">
          {loading ? (
            <Card className="p-4">Loading customers...</Card>
          ) : customers.length ? (
            customers.map((c) => (
              <Card className="p-4" key={c.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-sm text-slate-500">{c.phone ?? c.email ?? ""}</div>
                    <div className="text-sm mt-2">Outstanding: <span className="font-bold text-red-600">{formatMoney(fromMinorUnits(c.cachedOutstandingMinor ?? 0))}</span></div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/admin/customers/${c.id}`}>
                      <Button size="sm">Edit</Button>
                    </Link>
                    <Link href={`/shop/customers/${c.id}/statement`}>
                      <Button size="sm" variant="secondary">Statement</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-4">No customers found</Card>
          )}
        </div>
      </div>
    </div>
  );
}
