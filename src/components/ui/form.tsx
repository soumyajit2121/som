import * as React from "react";
import { cn } from "@/lib/utils";

const controlBase =
  "block w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-base text-ink placeholder:text-gray-500 disabled:bg-gray-100 disabled:text-gray-500 aria-[invalid=true]:border-red-600 sm:text-sm";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlBase, "min-h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlBase, "min-h-24", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(controlBase, "min-h-10 pr-8", className)} {...props} />;
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-ink mb-1 block text-sm font-semibold", className)} {...props} />;
}

export function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="mt-1 text-sm font-medium text-red-700" role="alert">
      {errors[0]}
    </p>
  );
}

export function FieldHint({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="text-muted mt-1 text-xs">
      {children}
    </p>
  );
}

/** Label + control + hint + error with correct aria wiring. */
export function Field({
  name,
  label,
  hint,
  errors,
  required,
  children,
  className,
}: {
  name: string;
  label: string;
  hint?: React.ReactNode;
  errors?: string[];
  required?: boolean;
  className?: string;
  children: (props: {
    id: string;
    name: string;
    "aria-invalid": boolean;
    "aria-describedby"?: string;
    required?: boolean;
  }) => React.ReactNode;
}) {
  const id = `field-${name}`;
  const describedBy = [hint ? `${id}-hint` : null, errors?.length ? `${id}-error` : null].filter(Boolean).join(" ");
  return (
    <div className={className}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-red-700"> *</span> : null}
      </Label>
      {children({
        id,
        name,
        "aria-invalid": Boolean(errors?.length),
        "aria-describedby": describedBy || undefined,
        required,
      })}
      {hint ? <FieldHint id={`${id}-hint`}>{hint}</FieldHint> : null}
      <FieldError id={`${id}-error`} errors={errors} />
    </div>
  );
}
