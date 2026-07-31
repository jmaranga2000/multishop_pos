import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariants = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSizes = "sm" | "md" | "lg";

type ButtonOwnProps<T extends React.ElementType> = {
  as?: T;
  variant?: ButtonVariants;
  size?: ButtonSizes;
  className?: string;
};

type ButtonProps<T extends React.ElementType> = ButtonOwnProps<T> & Omit<React.ComponentPropsWithoutRef<T>, keyof ButtonOwnProps<T>>;

export function Button<T extends React.ElementType = "button">({
  as,
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps<T>) {
  const Component = as || "button";
  const variants: Record<ButtonVariants, string> = {
    primary: "bg-[#173b89] text-white hover:bg-[#102f73] shadow-sm",
    secondary: "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
  };
  const sizes: Record<ButtonSizes, string> = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-4 text-sm",
    lg: "h-13 px-5 text-base",
  };

  return React.createElement(Component, {
    className: cn(
      "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
      variants[variant],
      sizes[size],
      className,
    ),
    ...props,
  });
}
