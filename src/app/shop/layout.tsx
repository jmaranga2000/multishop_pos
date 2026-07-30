import { Boxes, Gauge, ReceiptText, RefreshCw, RotateCcw, Settings, ShoppingCart, Store, Wallet, ArrowLeftRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { OfflineProvider } from "@/components/shop/offline-provider";
import { ConnectivityStatus } from "@/components/shop/connectivity-status";
import { requireShop } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function ShopLayout({children}:{children:React.ReactNode}){
 const user=await requireShop();
const nav=[
	{ href: "/shop/dashboard", label: "Dashboard", icon: "Gauge" },
	{ href: "/shop/pos", label: "Point of sale", icon: "ShoppingCart" },
	{ href: "/shop/sales", label: "Sales", icon: "ReceiptText" },
	{ href: "/shop/stock", label: "Stock", icon: "Boxes" },
	{ href: "/shop/register", label: "Register", icon: "Wallet" },
	{ href: "/shop/transfers", label: "Transfers", icon: "ArrowLeftRight" },
	{ href: "/shop/expenses", label: "Expenses", icon: "Store" },
	{ href: "/shop/refund-request", label: "Refund request", icon: "RotateCcw" },
	{ href: "/shop/synchronization", label: "Synchronization", icon: "RefreshCw" },
	{ href: "/shop/profile", label: "Profile", icon: "Settings" },
];
 return <OfflineProvider shopId={user.shopId} shopName={user.shop.name}><AppShell navItems={nav} userName={user.shop.name} accountLabel={`Shop account • ${user.shop.code}`} headerExtra={<ConnectivityStatus/>}>{children}</AppShell></OfflineProvider>;
}
