import React from "react";

type StatusVariant = "error" | "warning" | "info";

interface StatusBannerProps {
  message: string;
  variant?: StatusVariant;
  onRetry?: () => void;
  actionLabel?: string;
}

const variantClasses: Record<StatusVariant, string> = {
  error: "bg-red-50 border-red-200 text-red-700",
  warning: "bg-amber-50 border-amber-200 text-amber-700",
  info: "bg-blue-50 border-blue-200 text-blue-700",
};

export const StatusBanner: React.FC<StatusBannerProps> = ({
  message,
  variant = "info",
  onRetry,
  actionLabel = "Retry",
}) => {
  return (
    <div
      className={`mb-4 flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-sm ${variantClasses[variant]}`}
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
    >
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-current px-3 py-1 text-xs font-semibold uppercase tracking-wide"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
