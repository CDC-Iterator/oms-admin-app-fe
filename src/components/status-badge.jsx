import { cn } from "@/lib/utils";

/**
 * The one signature element reused across every list screen — see the
 * `.status-chip` rules in index.css. Renders the raw status text verbatim
 * (uppercased by CSS), never a fabricated label.
 */
export function StatusBadge({ tone = "neutral", children, className }) {
  return <span className={cn("status-chip", `status-chip--${tone}`, className)}>{children}</span>;
}
