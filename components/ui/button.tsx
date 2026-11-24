import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// High-desert surface: matte flat fills, soft 0.375rem corners, no shadows.
// The default button sits on a darker "stratum" edge at its base.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-b-2 border-second hover:bg-second",
        secondary: "bg-secondary text-secondary-foreground border-b-2 border-line hover:bg-line",
        outline: "border border-border bg-transparent text-foreground hover:bg-surface",
        ghost: "text-foreground hover:bg-surface",
        destructive: "bg-destructive text-destructive-foreground hover:bg-second",
        link: "text-primary underline decoration-line decoration-2 underline-offset-4 hover:decoration-primary",
      },
      // Every size yields at least 44px (min-h-11) so each control is a full touch target.
      size: {
        default: "min-h-11 px-4 py-2",
        sm: "min-h-11 px-3 py-1.5 text-sm",
        lg: "min-h-12 px-7 py-2 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
