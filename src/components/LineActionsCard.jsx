import { Button } from "@/components/ui/button.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { StatusBadge } from "@/components/status-badge.jsx";
import { useRetryLineActionMutation } from "../api/services/orders.js";

const PUSH_TONE = { success: "success", failed: "danger", pending: "pending", skipped: "neutral" };

function PushState({ label, status, error }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <StatusBadge tone={PUSH_TONE[status] ?? "neutral"}>{status}</StatusBadge>
      </div>
      {error && <p className="max-w-xs text-xs text-muted-foreground break-words">{error}</p>}
    </div>
  );
}

// Every cancel/return on the order's lines, with each platform's push state and failure note.
export function LineActionsCard({ lineItems, isAdmin }) {
  const [retry, { isLoading }] = useRetryLineActionMutation();
  const rows = lineItems
    .flatMap((li) => (li.actions ?? []).map((a) => ({ ...a, sku: li.external_sku })))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (rows.length === 0) return null;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Cancels &amp; returns</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((a) => {
          const failed = a.shopify_status === "failed" || a.pos_status === "failed";
          return (
            <div key={a.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg ring-1 ring-border p-2.5">
              <div className="space-y-0.5 text-sm">
                <p className="font-medium capitalize">
                  {a.action} · <span className="font-mono">{a.sku}</span> × {a.qty}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString()}
                  {a.reason ? ` · ${a.reason}` : ""}
                  {a.note ? ` · ${a.note}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-start gap-4">
                <PushState label="Shopify" status={a.shopify_status} error={a.shopify_error} />
                <PushState label="POS" status={a.pos_status} error={a.pos_error} />
                {isAdmin && failed && (
                  <Button size="sm" variant="outline" disabled={isLoading} onClick={() => retry(a.id)}>
                    Retry
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
