"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatMoney, fromMinorUnits } from "@/lib/utils";
import { ChevronLeft, Save } from "lucide-react";
import { toast } from "sonner";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  creditLimit: number;
  cachedOutstandingMinor: number;
  lastTransactionAt: string | null;
  shop: {
    id: string;
    name: string;
    code: string;
  };
}

export default function AdminCustomerDetailsPage() {
  const params = useParams();
  const customerId = params.id as string;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [creditLimitMinor, setCreditLimitMinor] = useState("");

  useEffect(() => {
    async function fetchCustomer() {
      try {
        const res = await fetch(`/api/admin/customers/${customerId}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to fetch customer");
        }
        const data = await res.json();
        setCustomer(data);
        setName(data.name);
        setPhone(data.phone || "");
        setEmail(data.email || "");
        setCreditLimitMinor(String(data.creditLimit));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchCustomer();
  }, [customerId]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Customer name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          creditLimit: Math.round(Number(creditLimitMinor) || 0),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update customer");
      }

      const updatedCustomer = await res.json();
      setCustomer(updatedCustomer);
      setEditing(false);
      toast.success("Customer updated successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update customer");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (customer) {
      setName(customer.name);
      setPhone(customer.phone || "");
      setEmail(customer.email || "");
      setCreditLimitMinor(String(customer.creditLimit));
      setEditing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 min-h-screen">
        <div className="max-w-2xl mx-auto">
          <Card className="p-6">Loading customer details...</Card>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-6 min-h-screen">
        <div className="max-w-2xl mx-auto">
          <Link href="/admin/customers">
            <Button variant="secondary" size="sm" className="mb-4">
              <ChevronLeft className="h-4 w-4" />
              Back to customers
            </Button>
          </Link>
          <Card className="p-6 text-red-600">
            {error || "Customer not found"}
          </Card>
        </div>
      </div>
    );
  }

  const availableCredit = customer.creditLimit - customer.cachedOutstandingMinor;
  const utilizationPercent = customer.creditLimit > 0
    ? Math.round((customer.cachedOutstandingMinor / customer.creditLimit) * 100)
    : 0;

  return (
    <div className="p-6 min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto">
        <Link href="/admin/customers">
          <Button variant="secondary" size="sm" className="mb-4">
            <ChevronLeft className="h-4 w-4" />
            Back to customers
          </Button>
        </Link>

        {/* Customer Info */}
        <Card className="p-6 mb-6">
          {!editing ? (
            <>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-bold">{customer.name}</h1>
                  <p className="text-slate-600 mt-1">
                    Shop: <span className="font-semibold">{customer.shop.name}</span> ({customer.shop.code})
                  </p>
                  {customer.phone && <p className="text-slate-600">Phone: {customer.phone}</p>}
                  {customer.email && <p className="text-slate-600">Email: {customer.email}</p>}
                </div>
                <Button onClick={() => setEditing(true)}>Edit</Button>
              </div>

              {/* Credit Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="border-l-4 border-red-500 pl-4">
                  <p className="text-sm text-slate-600">Outstanding</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatMoney(fromMinorUnits(customer.cachedOutstandingMinor))}
                  </p>
                </div>
                <div className="border-l-4 border-blue-500 pl-4">
                  <p className="text-sm text-slate-600">Credit Limit</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatMoney(fromMinorUnits(customer.creditLimit))}
                  </p>
                </div>
                <div className="border-l-4 border-green-500 pl-4">
                  <p className="text-sm text-slate-600">Available</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatMoney(fromMinorUnits(availableCredit))}
                  </p>
                </div>
              </div>

              {/* Utilization Bar */}
              {customer.creditLimit > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-slate-600">Credit Utilization</span>
                    <Badge tone={utilizationPercent > 80 ? "danger" : utilizationPercent > 50 ? "warning" : "success"}>
                      {utilizationPercent}%
                    </Badge>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        utilizationPercent > 80
                          ? "bg-red-500"
                          : utilizationPercent > 50
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                      style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {customer.lastTransactionAt && (
                <p className="text-xs text-slate-500 mt-4">
                  Last transaction: {new Date(customer.lastTransactionAt).toLocaleString()}
                </p>
              )}
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-6">Edit Customer</h2>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="mb-1 block text-sm font-medium">Customer Name</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Phone</label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Optional"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Optional"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Credit Limit</label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={creditLimitMinor}
                    onChange={(e) => setCreditLimitMinor(e.target.value)}
                    placeholder="0"
                    disabled={saving}
                  />
                  <p className="mt-1 text-xs text-slate-500">Value is in minor units (for example 10000 = KES 100.00).</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <p className="text-sm text-slate-600 col-span-2">
                    Shop: <span className="font-semibold">{customer.shop.name}</span>
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleCancel}
                  variant="secondary"
                  disabled={saving}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  className="flex-1"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
