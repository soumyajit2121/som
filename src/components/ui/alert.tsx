import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const tones = {
  info: { cls: "border-blue-300 bg-blue-50 text-blue-950", Icon: Info, label: "Information" },
  success: { cls: "border-green-300 bg-green-50 text-green-950", Icon: CheckCircle2, label: "Success" },
  warning: { cls: "border-amber-400 bg-amber-50 text-amber-950", Icon: AlertTriangle, label: "Warning" },
  error: { cls: "border-red-300 bg-red-50 text-red-950", Icon: XCircle, label: "Error" },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
  role,
}: {
  tone?: keyof typeof tones;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  const { cls, Icon, label } = tones[tone];
  return (
    <div
      className={cn("flex gap-3 rounded-lg border p-3 text-sm", cls, className)}
      role={role ?? (tone === "error" ? "alert" : "status")}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <span className="sr-only">{label}: </span>
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5" : undefined}>{children}</div> : null}
      </div>
    </div>
  );
}
