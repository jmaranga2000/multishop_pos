"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney, fromMinorUnits } from "@/lib/utils";

export function CustomerSearchClient({ initialCustomers, initialQuery }: { initialCustomers: any[]; initialQuery: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [customers, setCustomers] = useState(initialCustomers);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (query === initialQuery) {
      setCustomers(initialCustomers);
      return;
    }

    let active = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/customers?q=${encodeURIComponent(query)}`);
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
  }, [query, initialQuery, initialCustomers]);

  const handleSearch = (value: string) => {
    setQuery(value);
    startTransition(() => {
      const params = new URLSearchParams();
      if (value) params.set("q", value);
      const newUrl = `/admin/customers${params.toString() ? "?" + params.toString() : ""}`;
      router.push(newUrl);
    });
  };

  const handleClear = () => {
    setQuery("");
    startTransition(() => {
      router.push("/admin/customers");
    });
  };

  return (
    <>
      <Card className="p-4 mb-4">
        <div className="flex gap-2">
          <Input
            placeholder="Search customers"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <Button onClick={handleClear}>Clear</Button>
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
    </>
  );
}
