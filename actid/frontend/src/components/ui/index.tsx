import * as React from "react";
import { AlertTriangle, Info, CheckCircle2, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Button ───────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none";

    const variants = {
      primary: "bg-actid-blue text-white hover:bg-actid-blue-light active:scale-[0.98] shadow-sm",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      outline: "border border-actid-blue text-actid-blue hover:bg-actid-blue/5",
    };

    const sizes = {
      sm: "h-8 px-3 text-sm",
      md: "h-11 px-5 text-sm",
      lg: "h-13 px-6 text-base",
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

// ─── Badge ────────────────────────────────────────────────────────────────────

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "outline";
}

export const Badge = ({ className, variant = "default", ...props }: BadgeProps) => {
  const variants = {
    default: "bg-gray-100 text-gray-700",
    success: "bg-green-50 text-green-700 ring-1 ring-green-200",
    warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    danger: "bg-red-50 text-red-700 ring-1 ring-red-200",
    info: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    outline: "border border-current",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold",
        variants[variant],
        className
      )}
      {...props}
    />
  );
};

// ─── Status Badge ───────────────────────────────────────────────────────────────
// ACCESSIBILITY: document status is conveyed by icon + text + color together, never
// color alone (WCAG 1.4.1). One source of truth so every status reads the same way.
const STATUS_BADGE = {
  valid:         { variant: "success" as const, Icon: CheckCircle2,  label: "Valabil" },
  expiră_curând: { variant: "warning" as const, Icon: AlertTriangle, label: "Expiră curând" },
  expirat:       { variant: "danger"  as const, Icon: XCircle,       label: "Expirat" },
};

export function statusLabel(status?: string): string {
  return STATUS_BADGE[status as keyof typeof STATUS_BADGE]?.label ?? STATUS_BADGE.valid.label;
}

export const StatusBadge = ({ status, className }: { status?: string; className?: string }) => {
  const cfg = STATUS_BADGE[status as keyof typeof STATUS_BADGE] ?? STATUS_BADGE.valid;
  const Icon = cfg.Icon;
  return (
    <Badge variant={cfg.variant} className={className}>
      <Icon size={12} aria-hidden="true" />
      {cfg.label}
    </Badge>
  );
};

// ─── Card ─────────────────────────────────────────────────────────────────────

export const Card = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("bg-white rounded-2xl border border-border shadow-sm", className)}
    {...props}
  />
);

export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-4 pb-0", className)} {...props} />
);

export const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-4", className)} {...props} />
);

export const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-4 pt-0 flex items-center", className)} {...props} />
);

// ─── Input ────────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full h-11 rounded-xl border border-input bg-white px-4 py-2 text-sm",
              "placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-actid-blue/30 focus:border-actid-blue",
              "transition-all duration-150",
              icon && "pl-10",
              error && "border-destructive focus:ring-destructive/30",
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

// ─── Alert ────────────────────────────────────────────────────────────────────

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "warning" | "error" | "info" | "success";
  title?: string;
  onDismiss?: () => void;
}

export const Alert = ({ className, variant = "info", title, children, onDismiss, ...props }: AlertProps) => {
  const variants = {
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    error:   "bg-red-50 border-red-200 text-red-800",
    info:    "bg-blue-50 border-blue-200 text-blue-800",
    success: "bg-green-50 border-green-200 text-green-800",
  };
  const icons = {
    warning: AlertTriangle,
    error:   XCircle,
    info:    Info,
    success: CheckCircle2,
  };
  const IconComp = icons[variant];

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 p-4 rounded-xl border",
        variants[variant],
        className
      )}
      {...props}
    >
      <IconComp size={18} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold text-sm">{title}</p>}
        {children && <p className="text-sm mt-0.5 opacity-90">{children}</p>}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Închide"
          className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export const Skeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("skeleton", className)} {...props} />
);

// ─── Toast container ─────────────────────────────────────────────────────────

interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  // ACCESSIBILITY: optional inline action (e.g. "Anulează") so destructive actions are reversible (WCAG 3.3.4)
  action?: { label: string; onClick: () => void };
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = "Confirmă",
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmDialogProps) => {
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="absolute inset-0 bg-black/40 animate-fade-in"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 animate-fade-in">
        <h2 id="confirm-dialog-title" className="font-bold text-lg">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            Anulează
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            onClick={onConfirm}
            className="flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

export const ToastContainer = ({ toasts, onRemove }: { toasts: ToastItem[]; onRemove: (id: string) => void }) => {
  if (!toasts.length) return null;
  return (
    // ACCESSIBILITY: role=status + aria-live=polite so screen readers announce toasts (WCAG 4.1.3)
    <div
      className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] lg:bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium animate-fade-in",
            t.type === "success" && "bg-green-600",
            t.type === "error" && "bg-red-600",
            t.type === "info" && "bg-actid-blue"
          )}
        >
          <span>{t.type === "success" ? <CheckCircle2 size={16} aria-hidden="true" /> : t.type === "error" ? <XCircle size={16} aria-hidden="true" /> : <Info size={16} aria-hidden="true" />}</span>
          <span className="flex-1">{t.message}</span>
          {/* ACCESSIBILITY: inline undo/action button, large enough to tap */}
          {t.action && (
            <button
              onClick={() => { t.action!.onClick(); onRemove(t.id); }}
              className="font-bold underline underline-offset-2 px-2 py-1 -my-1 rounded hover:opacity-100 opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {t.action.label}
            </button>
          )}
          <button onClick={() => onRemove(t.id)} className="flex items-center justify-center min-w-9 min-h-9 -mr-2 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded" aria-label="Închide notificarea"><X size={16} aria-hidden="true" /></button>
        </div>
      ))}
    </div>
  );
};
