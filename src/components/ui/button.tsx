"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariants = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSizes = "sm" | "md" | "lg" | "icon";

type ButtonOwnProps<T extends React.ElementType> = {
  as?: T;
  variant?: ButtonVariants;
  size?: ButtonSizes;
  className?: string;
  loadingText?: string;
  autoLoading?: boolean;
  isLoading?: boolean;
};

type ButtonProps<T extends React.ElementType> = ButtonOwnProps<T> & Omit<React.ComponentPropsWithoutRef<T>, keyof ButtonOwnProps<T>>;

export const Button = React.forwardRef(function Button<T extends React.ElementType = "button">(
  { as, variant = "primary", size = "md", className, type, loadingText, autoLoading = true, isLoading: externalLoading, children, ...props }: ButtonProps<T>,
  ref: React.ForwardedRef<any>,
) {
  const [loading, setLoading] = React.useState(false);
  const innerRef = React.useRef<HTMLElement | null>(null);

  React.useImperativeHandle(ref, () => innerRef.current);

  const Component = (as as any) || "button";
  const safeType = (type as any) ?? (Component === "button" ? "submit" : undefined);
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
    icon: "h-10 w-10 p-0 text-sm",
  };

  // Derive a reasonable default loading text from the children if not provided
  const derivedLoadingText = React.useMemo(() => {
    if (loadingText) return loadingText;
    const text = typeof children === "string" ? children.toLowerCase() : "";
    if (text.includes("create") || text.includes("new") || text.includes("add")) return "Creating...";
    if (text.includes("update") || text.includes("save")) return "Updating...";
    if (text.includes("delete") || text.includes("remove")) return "Processing...";
    return "Processing...";
  }, [children, loadingText]);

  const isLoading = externalLoading ?? loading;

  React.useEffect(() => {
    if (!autoLoading) return;
    if (typeof window === "undefined") return;
    const el = innerRef.current as HTMLElement | null;
    if (!el) return;
    // find parent form
    let parent: HTMLElement | null = el.parentElement;
    while (parent && parent.tagName !== "FORM") parent = parent.parentElement;
    if (!parent) return;
    const onSubmit = () => setLoading(true);
    parent.addEventListener("submit", onSubmit as EventListener);
    return () => parent.removeEventListener("submit", onSubmit as EventListener);
  }, [autoLoading]);

  return (
    <Component
      ref={(node: any) => { innerRef.current = node; if (typeof ref === "function") ref(node); else if (ref) (ref as any).current = node; }}
      type={safeType}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={Boolean((props as any).disabled) || isLoading}
      {...(props as any)}
    >
      {isLoading ? <span>{derivedLoadingText}</span> : children}
    </Component>
  );
}) as <T extends React.ElementType = "button">(props: ButtonProps<T> & { ref?: React.Ref<any> }) => React.ReactElement;

export default Button;
