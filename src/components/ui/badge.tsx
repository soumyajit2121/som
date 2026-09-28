import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-gray-300 bg-gray-100 text-gray-800",
        green: "border-green-300 bg-green-50 text-green-900",
        amber: "border-amber-300 bg-amber-50 text-amber-900",
        red: "border-red-300 bg-red-50 text-red-900",
        blue: "border-blue-300 bg-blue-50 text-blue-900",
        purple: "border-purple-300 bg-purple-50 text-purple-900",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
