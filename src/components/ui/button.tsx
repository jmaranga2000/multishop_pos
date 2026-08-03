"use client";

import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariants = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSizes = "sm" | "md" | "lg" | "icon";

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  /** A serializable navigation target. Links stay inside this client component. */
  href?: string;
  target?: string;
  rel?: string;
  variant?: ButtonVariants;
  size?: ButtonSizes;
  className?: string;
  loadingText?: string;
  autoLoading?: boolean;
  isLoading?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(function Button(
  {
    href,
    target,
    rel,
    variant = "primary",
    size = "md",
    className,
    type,
    loadingText,
    autoLoading = true,
    isLoading: externalLoading,
    children,
    disabled,
    onClick,
    as: _as,
    ...buttonProps
  },
  ref,
) {
  const [loading, setLoading] = React.useState(false);
  const innerRef = React.useRef<HTMLButtonElement | HTMLAnchorElement | null>(null);

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

  const derivedLoadingText = React.useMemo(() => {
    if (loadingText) return loadingText;
    const text = typeof children === "string" ? children.toLowerCase() : "";
    if (text.includes("create") || text.includes("new") || text.includes("add")) return "Creating...";
    if (text.includes("update") || text.includes("save")) return "Updating...";
    return "Processing...";
  }, [children, loadingText]);
  const isLoading = externalLoading ?? loading;

  React.useEffect(() => {
    if (!autoLoading || href || typeof window === "undefined") return;
    const element = innerRef.current;
    if (!element) return;
    let parent: HTMLElement | null = element.parentElement;
    while (parent && parent.tagName !== "FORM") parent = parent.parentElement;
    if (!parent) return;
    const handleSubmit = () => setLoading(true);
    parent.addEventListener("submit", handleSubmit);
    return () => parent.removeEventListener("submit", handleSubmit);
  }, [autoLoading, href]);

  const buttonClassName = cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
  const content = isLoading ? (
    <span className="inline-flex items-center gap-2">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      {derivedLoadingText}
    </span>
  ) : children;
  const setRef = (node: HTMLButtonElement | HTMLAnchorElement | null) => {
    innerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  if (href) {
    return (
      <Link
        href={href}
        target={target}
        rel={rel}
        ref={setRef}
        className={buttonClassName}
        aria-busy={isLoading}
        aria-disabled={disabled || isLoading || undefined}
        onClick={(event) => {
          if (disabled || isLoading) event.preventDefault();
          else onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
        }}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      ref={setRef}
      type={type ?? "submit"}
      className={buttonClassName}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      onClick={onClick}
      {...buttonProps}
    >
      {content}
    </button>
  );
});

export default Button;
