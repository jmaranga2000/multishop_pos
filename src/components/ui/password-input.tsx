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
        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 items-center justify-center rounded-md bg-white border border-slate-200 text-slate-600"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default PasswordInput;
