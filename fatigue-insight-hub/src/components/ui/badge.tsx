import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Quiet rectangular tag (no pills): hairline border, small caps, no fill.
 * Signal colour is carried by text and border only.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-[4px] border px-1.5 py-[3px] text-[10.5px] font-medium uppercase leading-none tracking-[0.06em] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        default: "border-primary/35 text-primary",
        secondary: "border-border text-muted-foreground",
        destructive: "border-critical/40 text-critical",
        outline: "border-border text-foreground/80",
        success: "border-success/35 text-success",
        high: "border-high/40 text-high",
        warning: "border-warning/40 text-warning",
        critical: "border-critical/45 text-critical",
        info: "border-primary/35 text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
