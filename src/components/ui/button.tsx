import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 min-h-10 whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "bg-brand-700 text-white hover:bg-brand-800",
        secondary: "border border-line bg-white text-ink hover:bg-gray-50",
        danger: "bg-red-700 text-white hover:bg-red-800",
        ghost: "text-ink hover:bg-gray-100",
        link: "text-brand-700 underline-offset-4 hover:underline min-h-0 px-0",
      },
      size: {
        sm: "px-3 py-1.5 text-xs min-h-8",
        md: "px-4 py-2",
        lg: "px-5 py-3 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
