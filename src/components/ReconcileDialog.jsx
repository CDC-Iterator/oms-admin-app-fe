import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/status-badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.jsx";
import { useReconcileOrdersMutation } from "../api/services/orders.js";
import { formatApiError } from "../lib/errors.js";

const LINE = {
  linked: ["success", "Linked"],
  bundle: ["success", "Bundle linked"],
  unmapped: ["danger", "SKU not in catalog"],
  no_sku: ["danger", "No SKU in Shopify"],
  no_variant: ["danger", "No Shopify variant on the line"],
  lookup_failed: ["danger", "Couldn't reach Shopify"],
};
const POS = {
  queued: ["success", "Sent to POS (queued)"],
  ready_not_sent: ["pending", "Ready — not sent"],
  needs_pos_confirmation: ["pending", "POS already has part of this order — waiting for POS to confirm a second send"],
  nothing_to_send: ["neutral", "Nothing to send to POS"],
};

// Paste Shopify order names or ids; each is linked to the catalog, gets units suggested and (optionally) goes to POS.
export function ReconcileDialog({ open, onOpenChange, initialOrders = "" }) {
  const [text, setText] = useState(initialOrders);
  const [push, setPush] = useState(true);
  const [reconcile, { data, isLoading, error, reset }] = useReconcileOrdersMutation();

  useEffect(() => {
    if (open) {
      setText(initialOrders);
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const results = data?.results ?? [];
  const count = text.split(/[\s,;]+/).filter(Boolean).length;
  const run = () => reconcile({ orders: text, push_to_pos: push });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reconcile orders</DialogTitle>
          <DialogDescription>
            After fixing a SKU in Shopify: links each order's lines to the catalog, suggests their units and sends them to POS.
          </DialogDescription>
        </DialogHeader>

        {results.length === 0 ? (
          <div className="space-y-3 text-sm">
            <label className="block space-y-1">
              <span className="text-xs font-medium">Shopify order names or ids (up to 50)</span>
              <textarea
                className="min-h-28 w-full rounded-lg border border-input bg-transparent p-2 font-mono text-xs"
                placeholder="#CDC168637, #CDC168639&#10;#CDC168643"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" className="oms-checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} />
              Also send what POS hasn't had yet
            </label>
            {error && <p className="text-xs text-destructive">{formatApiError(error)}</p>}
          </div>
        ) : (
          <div className="min-h-0 space-y-2 overflow-y-auto text-sm">
            {results.map((r) => (
              <div key={r.ref} className="space-y-1 rounded-lg border border-border p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-medium">{r.order_name ?? r.ref}</span>
                  {!r.found && <StatusBadge tone="danger">Not found</StatusBadge>}
                  {r.skipped && <StatusBadge tone="neutral">{r.skipped}</StatusBadge>}
                  {r.pos && <StatusBadge tone={POS[r.pos]?.[0] ?? "neutral"}>{POS[r.pos]?.[1] ?? r.pos}</StatusBadge>}
                </div>
                {r.lines?.length === 0 && <p className="text-xs text-muted-foreground">No waiting lines on this order.</p>}
                {r.lines?.map((l) => (
                  <div key={l.line_id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono text-muted-foreground">line {l.line_id}</span>
                    <StatusBadge tone={LINE[l.result]?.[0] ?? "neutral"}>{LINE[l.result]?.[1] ?? l.result}</StatusBadge>
                  </div>
                ))}
                {r.suggested > 0 && <p className="text-xs text-muted-foreground">{r.suggested} line{r.suggested === 1 ? "" : "s"} got a suggested unit.</p>}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          {results.length === 0 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={run} disabled={isLoading || count === 0 || count > 50}>
                {isLoading ? "Reconciling…" : `Reconcile ${count} order${count === 1 ? "" : "s"}`}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={reset}>
                Reconcile more
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
