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
  const nav: Array<{ href: string; label: string; icon: string; count?: number; countTone?: "danger" | "warning" | "success" }> = [
    { href: "/admin/dashboard", label: "Overview", icon: "BarChart3" },
    { href: "/admin/shops", label: "Shops", icon: "Building2" },
    { href: "/admin/shops/archived", label: "Archived shops", icon: "Archive" },
    { href: "/admin/suppliers", label: "Suppliers", icon: "Truck" },
    { href: "/admin/products", label: "Products", icon: "Boxes" },
    { href: "/admin/inventory", label: "Inventory", icon: "Store" },
    { href: "/admin/sales", label: "Sales", icon: "ShoppingCart" },
    { href: "/admin/transfers", label: "Transfers", icon: "ArrowLeftRight" },
    { href: "/admin/registers", label: "Registers", icon: "Wallet" },
    { href: "/admin/reports", label: "Reports", icon: "FileSpreadsheet" },
    { href: "/admin/refunds", label: "Refunds", icon: "RotateCcw" },
    { href: "/admin/notifications", label: "Notifications", icon: "Bell", count: unread, countTone: "danger" },
    { href: "/admin/synchronization", label: "Synchronization", icon: "RefreshCw", count: conflictCount, countTone: "danger" },
    { href: "/admin/devices", label: "Devices", icon: "MonitorSmartphone" },
    { href: "/admin/salespeople", label: "Salespeople", icon: "UsersRound" },
    { href: "/admin/expenses", label: "Expenses", icon: "ReceiptText" },
    { href: "/admin/customers", label: "Customers", icon: "UsersRound" },
    { href: "/admin/customers/archived", label: "Archived customers", icon: "Archive" },
    { href: "/admin/settings", label: "Settings", icon: "Settings" },
  ];
  return <AppShell navItems={nav} userName={user.name} userEmail={user.email} accountLabel="Administrator" notificationCount={unread}>{children}</AppShell>;
}
