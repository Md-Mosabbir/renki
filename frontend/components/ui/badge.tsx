import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5.5 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-none px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.08em] uppercase whitespace-nowrap border-l-2 transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  {
    variants: {
      variant: {
        default: "border-l-brand bg-primary text-primary-foreground border-t-transparent border-r-transparent border-b-transparent",
        secondary: "border-l-border-strong bg-secondary text-secondary-foreground border-t-transparent border-r-transparent border-b-transparent",
        destructive: "border-l-destructive bg-destructive/10 text-destructive border-t-transparent border-r-transparent border-b-transparent",
        outline: "border-l-border-strong border-border bg-transparent text-muted-foreground border-t border-r border-b",
        brand: "border-l-brand bg-brand-muted text-brand-strong border-t-transparent border-r-transparent border-b-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  live = false,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean
    live?: boolean
  }) {
  if (asChild) {
    return (
      <Slot.Root
        data-slot="badge"
        data-variant={variant}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      >
        {children}
      </Slot.Root>
    )
  }

  return (
    <span
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {live && (
        <span
          aria-hidden
          className="renki-mark-hop size-1.5 shrink-0 bg-brand"
          style={{ animationDuration: '1.6s' }}
        />
      )}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }


