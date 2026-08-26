import { cn } from "@/lib/utils";

/**
 * The panel shown in place of a table — either because there's genuinely
 * nothing yet (tone="neutral") or because the list failed to load
 * (tone="danger"). Same shape either way: an empty screen is an invitation
 * to act, an error explains what happened and how to fix it.
 */
export function EmptyState({ icon: Icon, title, description, tone = "neutral", action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
      {Icon && (
        <div
          className={cn(
            "flex size-11 items-center justify-center rounded-full bg-muted",
            tone === "danger" ? "text-destructive" : "text-muted-foreground"
          )}
        >
          <Icon className="size-5" strokeWidth={1.75} />
        </div>
      )}
      <div className="space-y-1">
        <p className="font-heading text-sm font-medium text-foreground">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
