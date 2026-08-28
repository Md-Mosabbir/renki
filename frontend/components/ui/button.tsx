import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button relative overflow-hidden inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all duration-200 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary)_88%,var(--brand))]",
        outline:
          "border-border bg-background hover:bg-muted hover:border-border-strong hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-2 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1.5 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-2 px-3.5 text-sm has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xl: "h-14 gap-3 px-5 text-sm font-semibold uppercase tracking-[0.1em] rounded-none",
        icon: "size-8 p-0",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-14 rounded-none",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const FILLED_VARIANTS = new Set(["default", "secondary", "destructive"])

const MARK_SIZE: Record<string, string> = {
  xs: "size-1.5",
  sm: "size-1.5",
  default: "size-2",
  lg: "size-2",
  xl: "size-2.5",
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  block = false,
  square = false,
  mark,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Full width — pairs with size="xl" for the editorial CTA. */
    block?: boolean
    /** Square shoulders (radius 0). */
    square?: boolean
    mark?: boolean
  }) {
  const isIcon = typeof size === "string" && size.startsWith("icon")
  const vName = variant ?? "default"
  const sName = size ?? "default"
  const editorial = sName === "xl"
  const shouldShowMark = (mark ?? (FILLED_VARIANTS.has(vName) && !isIcon)) && !isIcon
  const shouldShowRule = (FILLED_VARIANTS.has(vName) || vName === "outline") && !isIcon
  const markClass = MARK_SIZE[sName] ?? MARK_SIZE.default

  const classes = cn(
    buttonVariants({ variant, size, className }),
    block && "flex w-full",
    editorial && block && "justify-between",
    (square || editorial) && "rounded-none"
  )

  if (asChild) {
    return (
      <Slot.Root
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={classes}
        {...props}
      >
        {children}
      </Slot.Root>
    )
  }

  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={classes}
      {...props}
    >
      {shouldShowMark && (
        <span
          aria-hidden
          className={cn(
            "bg-brand shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.76,0,0.24,1)] group-hover/button:rotate-45",
            markClass
          )}
        />
      )}
      {editorial && block ? (
        <span className="flex items-center gap-3">{children}</span>
      ) : (
        children
      )}
      {shouldShowRule && (
        <span
          aria-hidden
          className="bg-brand absolute bottom-0 left-0 h-[2px] w-full origin-left scale-x-0 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/button:scale-x-100"
        />
      )}
    </button>
  )
}

export { Button, buttonVariants }
