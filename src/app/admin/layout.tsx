import { AppShell } from "@/components/layout/app-shell";
import { requireAdmin } from "@/lib/rbac";
import { getUnreadNotificationCount } from "@/services/admin/layout-service";
import { getOpenSynchronizationConflictCount } from "@/services/admin/synchronization-service";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const [unread, conflictCount] = await Promise.all([
    getUnreadNotificationCount(user.id),
    getOpenSynchronizationConflictCount(user.businessId),
  ]);
  const nav: Array<{ label: string; items: Array<{ href: string; label: string; icon: string; count?: number; countTone?: "danger" | "warning" | "success" }> }> = [
    { label: "Workspace", items: [
      { href: "/admin/dashboard", label: "Overview", icon: "BarChart3" },
      { href: "/admin/shops", label: "Shops", icon: "Building2" },
      { href: "/admin/shops/archived", label: "Archived shops", icon: "Archive" },
    ] },
    { label: "Stock & procurement", items: [
      { href: "/admin/products", label: "Products", icon: "Boxes" },
      { href: "/admin/inventory", label: "Inventory", icon: "Store" },
      { href: "/admin/procurement", label: "Procurement", icon: "ClipboardList" },
      { href: "/admin/suppliers", label: "Suppliers", icon: "Truck" },
      { href: "/admin/stocktakes", label: "Stocktakes", icon: "ScanLine" },
      { href: "/admin/transfers", label: "Transfers", icon: "ArrowLeftRight" },
    ] },
    { label: "Sales & registers", items: [
      { href: "/admin/sales", label: "Sales", icon: "ShoppingCart" },
      { href: "/admin/counters", label: "Physical counters", icon: "MonitorPlay" },
      { href: "/admin/registers", label: "Registers", icon: "Wallet" },
      { href: "/admin/refunds", label: "Refunds", icon: "RotateCcw" },
      { href: "/admin/etims", label: "eTIMS / VAT", icon: "ReceiptText" },
    ] },
    { label: "Insights & finance", items: [
      { href: "/admin/reports", label: "Reports", icon: "FileSpreadsheet" },
      { href: "/admin/expenses", label: "Expenses", icon: "ReceiptText" },
      { href: "/admin/employee-performance", label: "Employee performance", icon: "ChartNoAxesCombined" },
      { href: "/admin/customers", label: "Customers", icon: "UsersRound" },
      { href: "/admin/customers/archived", label: "Archived customers", icon: "Archive" },
    ] },
    { label: "People & system", items: [
      { href: "/admin/salespeople", label: "Salespeople", icon: "UsersRound" },
      { href: "/admin/devices", label: "Devices", icon: "MonitorSmartphone" },
      { href: "/admin/notifications", label: "Notifications", icon: "Bell", count: unread, countTone: "danger" },
      { href: "/admin/synchronization", label: "Synchronization", icon: "RefreshCw", count: conflictCount, countTone: "danger" },
      { href: "/admin/settings", label: "Settings", icon: "Settings" },
    ] },
  ];
  return <AppShell navItems={nav} userName={user.name} userEmail={user.email} accountLabel="Administrator" notificationCount={unread}>{children}</AppShell>;
}
