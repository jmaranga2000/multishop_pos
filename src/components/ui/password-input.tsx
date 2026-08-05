"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

type PasswordInputProps = React.InputHTMLAttributes<HTMLInputElement> & { name: string };

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative w-full">
      <Input {...props} type={visible ? "text" : "password"} className={`${className ?? ""} pr-12 w-full`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-2 z-10 inline-flex items-center justify-center rounded-lg px-2 text-slate-600 hover:bg-slate-100"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default PasswordInput;
