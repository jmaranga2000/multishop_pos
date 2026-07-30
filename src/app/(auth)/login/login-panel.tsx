"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoginForm } from "./login-form";

export function LoginPanel() {
  const [role, setRole] = useState<"SHOP" | "ADMIN">("SHOP");

  return <div>
      <div className="mb-6 flex gap-2">
      <Button variant={role === "SHOP" ? "primary" : "ghost"} onClick={() => setRole("SHOP")}>Shop access</Button>
      <Button variant={role === "ADMIN" ? "primary" : "ghost"} onClick={() => setRole("ADMIN")}>Administrator</Button>
    </div>
    <LoginForm
      emailPlaceholder={role === "SHOP" ? "shop@example.com" : "admin@example.com"}
      passwordPlaceholder={role === "SHOP" ? "Shop password" : "Administrator password"}
      helpText={role === "SHOP" ? "Sign in with the shared shop account issued by your administrator." : "Administrator accounts manage businesses, shops and registers."}
    />
  </div>;
}

export default LoginPanel;
