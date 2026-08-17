"use client";

import { useRef } from "react";

type ShopOption = { id: string; name: string };
type EmployeeOption = { id: string; name: string };

type EmployeePerformanceFiltersProps = {
  shops: ShopOption[];
  employees: EmployeeOption[];
  values: { shopId?: string; employeeId?: string; from: string; to: string };
};

export function EmployeePerformanceFilters({ shops, employees, values }: EmployeePerformanceFiltersProps) {
  const formRef = useRef<HTMLFormElement>(null);

  function submitFilters() {
    formRef.current?.requestSubmit();
  }

  function submitShopFilter() {
    const employeeField = formRef.current?.elements.namedItem("employeeId");
    if (employeeField instanceof HTMLSelectElement) employeeField.value = "";
    submitFilters();
  }

  return (
    <form ref={formRef} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_180px_180px]" method="get">
      <select name="shopId" defaultValue={values.shopId} onChange={submitShopFilter} className="rounded-lg border bg-white px-3 py-2">
        <option value="">All shops</option>
        {shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
      </select>
      <select name="employeeId" defaultValue={values.employeeId} onChange={submitFilters} className="rounded-lg border bg-white px-3 py-2">
        <option value="">All employees</option>
        {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
      </select>
      <input name="from" type="date" defaultValue={values.from} onChange={submitFilters} className="rounded-lg border px-3 py-2" />
      <input name="to" type="date" defaultValue={values.to} onChange={submitFilters} className="rounded-lg border px-3 py-2" />
    </form>
  );
}