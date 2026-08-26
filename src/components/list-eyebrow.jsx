import { Badge } from "@/components/ui/badge";

/**
 * Sits above every list table. The pulsing dot + label is a real,
 * load-bearing statement, not decoration — the default ("Synced via
 * webhook") is only true for the Shopify-fed lists (orders, inventory,
 * fulfillments, customers; see backend/shopify/views.py WebhookView), which
 * arrive by push rather than a poll/sync timer. Screens whose data isn't
 * Shopify-sourced (e.g. admin users, managed by CRUD in this app) must pass
 * their own `label` and `live={false}` rather than inherit that claim.
 */
export function ListEyebrow({ count, noun = "items", label = "Synced via webhook", live = true }) {
  return (
    <div className="flex items-center justify-between gap-3 pb-3">
      <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {live && <span className="pulse-dot" />}
        {label}
      </div>
      <Badge variant="outline" className="font-mono tabular-nums">
        {count} {noun}
      </Badge>
    </div>
  );
}
