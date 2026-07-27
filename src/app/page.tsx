import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(user.role === "ADMIN" ? "/admin/dashboard" : "/shop/dashboard");
}
