"use client";
// Komponen dasar web owner, mengikuti replica/design/components.md.
import { forwardRef, useId } from "react";

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};
const VARIANT = {
  primary: "bg-accent text-on-accent active:bg-accent-pressed",
  secondary: "bg-surface-raised text-fg border border-border active:bg-accent-soft",
  ghost: "bg-transparent text-fg active:bg-accent-soft",
  danger: "bg-danger text-on-danger",
};
const SIZE = { sm: "h-9 px-3 text-sm", md: "h-12 px-4 text-base", lg: "h-14 px-5 text-base" };

export function Button({ variant = "primary", size = "md", loading, disabled, className = "", children, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-surface disabled:text-muted ${VARIANT[variant]} ${SIZE[size]} ${className}`}
    >
      {loading && <span aria-hidden className="size-4 animate-spin rounded-pill border-2 border-current border-r-transparent" />}
      {children}
    </button>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; help?: string; error?: string; prefix?: string; suffix?: string };

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, help, error, prefix, suffix, className = "", ...rest }, ref) {
  const id = useId();
  const desc = error ? `${id}-err` : help ? `${id}-help` : undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-fg">{label}</label>
      <div
        className={`flex h-12 items-center gap-2 rounded-md border bg-bg px-3 focus-within:border-focus focus-within:ring-1 focus-within:ring-focus ${
          error ? "border-danger ring-1 ring-danger" : "border-input"
        }`}
      >
        {prefix && <span className="font-medium text-muted">{prefix}</span>}
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={desc}
          className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-muted"
          {...rest}
        />
        {suffix && <span className="font-medium text-muted">{suffix}</span>}
      </div>
      {error ? (
        <p id={`${id}-err`} className="text-xs font-medium text-danger">{error}</p>
      ) : help ? (
        <p id={`${id}-help`} className="text-xs text-muted">{help}</p>
      ) : null}
    </div>
  );
});

export function Select({ label, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">{label}</label>
      <select id={id} className="h-12 rounded-md border border-input bg-bg px-3 text-base text-fg" {...rest}>{children}</select>
    </div>
  );
}

export function Card({ className = "", ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-lg border border-border bg-surface-raised p-4 ${className}`} {...rest} />;
}

export function Alert({ tone = "danger", children }: { tone?: "danger" | "success" | "info" | "warning"; children: React.ReactNode }) {
  const t = { danger: "bg-danger-soft text-danger", success: "bg-success-soft text-success", info: "bg-info-soft text-info", warning: "bg-warning-soft text-warning" }[tone];
  return <div role={tone === "danger" ? "alert" : "status"} className={`rounded-md px-4 py-3 text-sm font-medium ${t}`}>{children}</div>;
}
