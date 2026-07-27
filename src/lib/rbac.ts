import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";

export { getCurrentUser } from "./auth";

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/unauthorized");
  return user;
}

export async function requireShop() {
  const user = await requireUser();
  if (user.role !== "SHOP" || !user.shopId || !user.shop) redirect("/unauthorized");
  return user as typeof user & {
    role: "SHOP";
    shopId: string;
    shop: { id: string; name: string; code: string; isActive: boolean };
  };
}
