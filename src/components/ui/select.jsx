import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Lightweight native <select>, styled to match Input/Button — a stand-in for
 * the shadcn `select` primitive (not yet installed; add via `npx shadcn add
 * select` when the Base UI popover version is wanted). Good enough for the
 * plain filter/picker dropdowns on the OMS screens.
 */
export function Select({ className, children, ...props }) {
  return (
    <div className="relative inline-flex">
      <select
        data-slot="select"
        className={cn(
          "h-8 min-w-0 appearance-none rounded-lg border border-input bg-transparent py-1 pr-7 pl-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground"
        strokeWidth={2}
      />
    </div>
  );
}
