"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PricingRow = {
  unitId: string;
  costPrice: string;
  sellingPrice: string;
};

export function ProductPricingBuilder({
  units,
  initialRows = [],
}: {
  units: Array<{ id: string; name: string; symbol: string }>;
  initialRows?: Array<{ unitId: string; costPrice: number; sellingPrice: number }>;
}) {
  const [rows, setRows] = useState<PricingRow[]>(() => {
    if (initialRows.length) {
      return initialRows.map((row) => ({
        unitId: row.unitId,
        costPrice: String(row.costPrice),
        sellingPrice: String(row.sellingPrice),
      }));
    }
    return [
      {
        unitId: units[0]?.id ?? "",
        costPrice: "0",
        sellingPrice: "0",
      },
    ];
  });

  const serialized = useMemo(() => JSON.stringify(rows.map((row) => ({
    unitId: row.unitId,
    costPrice: Number(row.costPrice || 0),
    sellingPrice: Number(row.sellingPrice || 0),
  }))), [rows]);

  function updateRow(index: number, key: keyof PricingRow, value: string) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  }

  function addRow() {
    setRows((current) => [
      ...current,
      {
        unitId: units[0]?.id ?? "",
        costPrice: "0",
        sellingPrice: "0",
      },
    ]);
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="unitPricing" value={serialized} />
      <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
        Add one or more unit/price pairs for this product. The first option becomes the default selling unit on the POS.
      </div>
      {rows.map((row, index) => (
        <div key={`${index}-${row.unitId}`} className="rounded-2xl border border-slate-200 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-800">Unit option {index + 1}</p>
            {rows.length > 1 ? (
              <button type="button" onClick={() => removeRow(index)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700">
                <Trash2 className="h-3.5 w-3.5" />Remove
              </button>
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <select
              value={row.unitId}
              onChange={(event) => updateRow(index, "unitId", event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              required
            >
              <option value="">Select unit</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.name} ({unit.symbol})</option>
              ))}
            </select>
            <Input
              value={row.costPrice}
              onChange={(event) => updateRow(index, "costPrice", event.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="Cost price"
              required
            />
            <Input
              value={row.sellingPrice}
              onChange={(event) => updateRow(index, "sellingPrice", event.target.value)}
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Selling price"
              required
            />
          </div>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={addRow}>
        <Plus className="h-4 w-4" />Add unit option
      </Button>
    </div>
  );
}
