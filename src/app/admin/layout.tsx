import { AppShell } from "@/components/layout/app-shell";
import { requireAdmin } from "@/lib/rbac";
import { getUnreadNotificationCount } from "@/services/admin/layout-service";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const unread = await getUnreadNotificationCount(user.id);
  const nav = [
    { href: "/admin/dashboard", label: "Overview", icon: "BarChart3" },
    { href: "/admin/shops", label: "Shops", icon: "Building2" },
    { href: "/admin/products", label: "Products", icon: "Boxes" },
    { href: "/admin/inventory", label: "Inventory", icon: "Store" },
    { href: "/admin/sales", label: "Sales", icon: "ShoppingCart" },
    { href: "/admin/transfers", label: "Transfers", icon: "ArrowLeftRight" },
    { href: "/admin/registers", label: "Registers", icon: "Wallet" },
    { href: "/admin/reports", label: "Reports", icon: "FileSpreadsheet" },
    { href: "/admin/refunds", label: "Refunds", icon: "RotateCcw" },
    { href: "/admin/notifications", label: "Notifications", icon: "Bell" },
    { href: "/admin/synchronization", label: "Synchronization", icon: "RefreshCw" },
    { href: "/admin/devices", label: "Devices", icon: "MonitorSmartphone" },
    { href: "/admin/salespeople", label: "Salespeople", icon: "UsersRound" },
    { href: "/admin/expenses", label: "Expenses", icon: "ReceiptText" },
    { href: "/admin/settings", label: "Settings", icon: "Settings" },
  ];
  return <AppShell navItems={nav} userName={user.name} userEmail={user.email} accountLabel="Administrator" notificationCount={unread}>{children}</AppShell>;
}
