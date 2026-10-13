import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { Select } from "@/components/ui/select.jsx";
import { usePostLineActionMutation } from "../api/services/orders.js";
import { formatApiError } from "../lib/errors.js";

// Shopify ReturnReason values the backend maps 1:1 (anything else goes as OTHER).
const RETURN_REASONS = [
  { value: "unwanted", label: "Customer changed their mind" },
  { value: "size_too_small", label: "Size too small" },
  { value: "size_too_large", label: "Size too large" },
  { value: "defective", label: "Damaged or defective" },
  { value: "not_as_described", label: "Not as described" },
  { value: "wrong_item", label: "Wrong item received" },
  { value: "other", label: "Other" },
];

// `target` = { orderId, line, action: "cancel" | "return" } or null (closed).
export function LineActionDialog({ target, onClose }) {
  const [postAction, { isLoading }] = usePostLineActionMutation();
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("unwanted");
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);

  if (!target) return null;
  const { orderId, line, action } = target;
  const max = action === "cancel" ? line.cancellable_qty : line.returnable_qty;
  const verb = action === "cancel" ? "Cancel" : "Return";

  const submit = async () => {
    setError(null);
    try {
      await postAction({
        orderId,
        lineItemId: line.id,
        body: { action, qty: Number(qty), reason: action === "return" ? reason : "", note },
      }).unwrap();
      onClose();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {verb} {line.external_sku}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <Label htmlFor="line-action-qty">Quantity (up to {max})</Label>
            <Input
              id="line-action-qty"
              type="number"
              min={1}
              max={max}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>
          {action === "return" && (
            <div className="space-y-1">
              <Label htmlFor="line-action-reason">Reason</Label>
              <Select id="line-action-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                {RETURN_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="line-action-note">Note (optional)</Label>
            <Input id="line-action-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            The unit goes back into stock and the change is sent to Shopify and the POS. Refunds are not issued here.
          </p>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="destructive" onClick={submit} disabled={isLoading || !(Number(qty) >= 1 && Number(qty) <= max)}>
            {isLoading ? "Working…" : verb}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
