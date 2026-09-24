import { useEffect, useState } from "react";
import { ArrowLeft, Ban, PackageCheck, Pencil, Plus, RefreshCw, Truck, Undo2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { Alert, AlertDescription } from "@/components/ui/alert.jsx";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Select } from "@/components/ui/select.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { ChannelBadge } from "@/components/ChannelBadge.jsx";
import { EmptyState } from "@/components/empty-state.jsx";
import { StatusBadge } from "@/components/status-badge.jsx";
import { useAuth } from "../hooks/useAuth.js";
import {
  useGetOrderQuery,
  useGetSuggestedUnitQuery,
  usePostOrderEventMutation,
  useRefreshSuggestedUnitMutation,
} from "../api/services/orders.js";
import {
  useCreateManualShipmentMutation,
  useGetShipmentsQuery,
  useUpdateShipmentMutation,
} from "../api/services/fulfilment.js";
import { formatApiError } from "../lib/errors.js";
import { fulfillmentTone, paymentTone, reservationTone, SUGGESTION_HIDDEN_STATUSES } from "../lib/status.js";

const SHIPMENT_STATUS_OPTIONS = [
  { value: "created", label: "Created" },
  { value: "in_transit", label: "In transit" },
  { value: "delivered", label: "Delivered" },
  { value: "rto", label: "RTO" },
  { value: "cancelled", label: "Cancelled" },
];

const SHIPMENT_STATUS_TONE = {
  created: "pending",
  in_transit: "pending",
  delivered: "success",
  rto: "danger",
  cancelled: "danger",
};

const EVENT_MODES = {
  cancelled: { label: "Cancel order", verb: "Cancel", icon: Ban, description: "The reserved unit is released back into the ledger. This can't be undone." },
  returned: { label: "Mark returned", verb: "Return", icon: Undo2, description: "The unit rejoins the same ledger it left — availability corrects across every channel." },
  rto: { label: "Mark RTO", verb: "RTO", icon: PackageCheck, description: "Return-to-origin: the unit restocks at its original location." },
};

function SuggestedUnitCell({ orderId, orderStatus, lineItem }) {
  const confirmed = Boolean(lineItem.inventory_unit);
  const showSuggestion = !SUGGESTION_HIDDEN_STATUSES.has(orderStatus);
  const { data, isFetching } = useGetSuggestedUnitQuery(
    { orderId, lineItemId: lineItem.id },
    { skip: confirmed || !showSuggestion }
  );
  const [refresh, { isLoading: isRefreshing }] = useRefreshSuggestedUnitMutation();

  if (confirmed) {
    return <StatusBadge tone="success">Confirmed · {lineItem.inventory_unit}</StatusBadge>;
  }
  if (!showSuggestion) {
    return <span className="text-xs text-muted-foreground">No unit assigned</span>;
  }
  if (isFetching) return <Skeleton className="h-5 w-24" />;

  const unit = data?.suggested_inventory_unit;
  if (!unit) return <span className="text-xs text-muted-foreground">No suggestion yet</span>;

  return (
    <div className="flex items-center gap-1.5">
      <StatusBadge tone={unit.stale ? "danger" : "pending"}>
        {unit.barcode} @ {unit.location}
        {unit.stale ? " (stale)" : ""}
      </StatusBadge>
      {unit.stale && (
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={isRefreshing}
          onClick={() => refresh({ orderId, lineItemId: lineItem.id })}
          aria-label="Refresh suggestion"
        >
          <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      )}
    </div>
  );
}

// Create/edit modal for a single shipment. `shipment` present → edit
// (courier/line items fixed, only carrier details + status change);
// `shipment` absent → create (manual courier only, line-item picker).
function ShipmentDialog({ orderId, shipment, shippableLines, open, onOpenChange }) {
  const isEditing = Boolean(shipment);
  const [createManualShipment, { isLoading: isCreating }] = useCreateManualShipmentMutation();
  const [updateShipment, { isLoading: isUpdating }] = useUpdateShipmentMutation();
  const isSaving = isCreating || isUpdating;

  const [awb, setAwb] = useState("");
  const [carrierName, setCarrierName] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [shipmentStatus, setShipmentStatus] = useState("created");
  const [qtyByLine, setQtyByLine] = useState({});
  const [formError, setFormError] = useState(null);

  // Re-seed the form from `shipment` (or blank, for create) each time the
  // dialog opens — a plain useState initializer only runs once per mount.
  useEffect(() => {
    if (!open) return;
    setAwb(shipment?.awb_number ?? "");
    setCarrierName(shipment?.carrier_name ?? "");
    setTrackingUrl(shipment?.tracking_url ?? "");
    setShipmentStatus(shipment?.status ?? "created");
    setQtyByLine(isEditing ? {} : Object.fromEntries(shippableLines.map((li) => [li.id, li.remaining])));
    setFormError(null);
  }, [open, shipment]);

  const toggleLine = (li, checked) => {
    setQtyByLine((prev) => {
      const next = { ...prev };
      if (checked) next[li.id] = li.remaining;
      else delete next[li.id];
      return next;
    });
  };

  const selectedLineItems = Object.entries(qtyByLine).filter(([, qty]) => qty > 0);

  const handleSubmit = async () => {
    setFormError(null);
    try {
      if (isEditing) {
        await updateShipment({
          orderId,
          shipmentId: shipment.id,
          awb_number: awb,
          carrier_name: carrierName,
          tracking_url: trackingUrl,
          status: shipmentStatus,
        }).unwrap();
      } else {
        await createManualShipment({
          orderId,
          awb_number: awb,
          carrier_name: carrierName,
          tracking_url: trackingUrl || undefined,
          line_items: selectedLineItems.map(([line_item, qty]) => ({ line_item: Number(line_item), qty })),
        }).unwrap();
      }
      onOpenChange(false);
    } catch (err) {
      setFormError(formatApiError(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit shipment" : "Book shipment"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {isEditing ? (
            <Select value={shipmentStatus} onChange={(e) => setShipmentStatus(e.target.value)}>
              {SHIPMENT_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Courier: <span className="font-medium text-foreground">Manual</span> — Shipway/Shipdelight/Quicklee
                are coming soon.
              </p>

              <div className="space-y-1.5">
                {shippableLines.map((li) => (
                  <label key={li.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={li.id in qtyByLine}
                      onChange={(e) => toggleLine(li, e.target.checked)}
                    />
                    <span className="font-mono text-xs">{li.external_sku}</span>
                    <span className="text-xs text-muted-foreground">({li.remaining} unshipped)</span>
                  </label>
                ))}
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="AWB number" value={awb} onChange={(e) => setAwb(e.target.value)} />
            <Input placeholder="Carrier name" value={carrierName} onChange={(e) => setCarrierName(e.target.value)} />
            <Input
              placeholder="Tracking URL (optional)"
              className="col-span-2"
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
            />
          </div>

          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={isSaving || !awb || !carrierName || (!isEditing && selectedLineItems.length === 0)}
          >
            {isSaving ? "Saving…" : isEditing ? "Save changes" : "Book shipment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Dedicated fulfillment/shipment creation — separate from the Lines card.
// Shipment history is visible to any authenticated role; create/edit is
// admin-only (mirrors the backend's IsAdmin gate on those endpoints).
// Dropship (`is_dropship`) lines never appear as shippable — the channel's
// own vendor (Shipturtle) fulfills those, this OMS never ships them.
function FulfillmentCard({ order }) {
  const { user } = useAuth();
  const isAdmin = user?.is_superuser || user?.role === "admin";
  const orderId = order.id;
  const lineItems = (order.line_items ?? []).filter((li) => !li.is_dropship);

  const { data: shipments, isFetching, error, refetch } = useGetShipmentsQuery(orderId);
  const [dialogTarget, setDialogTarget] = useState(null); // null closed, {} create, shipment edit

  const shippedByLine = {};
  for (const s of shipments ?? []) {
    for (const li of s.line_items) {
      shippedByLine[li.order_line_item] = (shippedByLine[li.order_line_item] ?? 0) + li.qty;
    }
  }
  const shippableLines = lineItems
    .map((li) => ({ ...li, remaining: li.qty - (shippedByLine[li.id] ?? 0) }))
    .filter((li) => li.remaining > 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-sm font-medium">Fulfillment</CardTitle>
          <p className="text-xs text-muted-foreground">Book a shipment and push tracking back to the channel.</p>
        </div>
        {isAdmin && shippableLines.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setDialogTarget({})}>
            <Plus className="size-3.5" />
            Book shipment
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {formatApiError(error)}{" "}
              <Button size="sm" variant="outline" onClick={refetch} className="ml-2">
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : isFetching && !shipments ? (
          <Skeleton className="h-16 w-full" />
        ) : shipments && shipments.length > 0 ? (
          <div className="space-y-2">
            {shipments.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <Truck className="size-3.5 text-muted-foreground" />
                  <span className="font-medium capitalize">{s.carrier_name || s.courier}</span>
                  {s.awb_number && <span className="font-mono text-xs text-muted-foreground">{s.awb_number}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={SHIPMENT_STATUS_TONE[s.status] ?? "neutral"}>{s.status}</StatusBadge>
                  {isAdmin && (
                    <Button variant="ghost" size="icon-sm" onClick={() => setDialogTarget(s)} aria-label="Edit shipment">
                      <Pencil className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No shipments booked yet.</p>
        )}
      </CardContent>

      {isAdmin && (
        <ShipmentDialog
          orderId={orderId}
          shipment={dialogTarget && dialogTarget.id ? dialogTarget : null}
          shippableLines={shippableLines}
          open={Boolean(dialogTarget)}
          onOpenChange={(open) => !open && setDialogTarget(null)}
        />
      )}
    </Card>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: order, isFetching, error, refetch } = useGetOrderQuery(id);
  const [postEvent, { isLoading: isPosting }] = usePostOrderEventMutation();
  const [confirmMode, setConfirmMode] = useState(null);
  const [eventError, setEventError] = useState(null);

  const handleEvent = async () => {
    setEventError(null);
    try {
      await postEvent({ id, event_type: confirmMode }).unwrap();
      setConfirmMode(null);
    } catch (err) {
      setEventError(formatApiError(err));
    }
  };

  const canReverse = order && ["pending", "confirmed"].includes(order.status);

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/orders")}>
        <ArrowLeft className="size-3.5" />
        Back to orders
      </Button>

      {isFetching && !order && (
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {error && (
        <EmptyState
          tone="danger"
          title="Couldn't load this order"
          description={`${formatApiError(error)} — try again.`}
          action={
            <Button size="sm" variant="outline" onClick={refetch}>
              Try again
            </Button>
          }
        />
      )}

      {order && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="font-mono text-base" title={order.external_order_id}>
                    {order.order_name || order.external_order_id}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground font-mono">
                    Placed {new Date(order.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <ChannelBadge channel={order.channel} />
                  <StatusBadge tone={reservationTone(order.status)}>{order.status}</StatusBadge>
                  {order.payment_status && (
                    <StatusBadge tone={paymentTone(order.payment_status)}>{order.payment_status}</StatusBadge>
                  )}
                  <StatusBadge tone={fulfillmentTone(order.fulfillment_status)}>{order.fulfillment_status}</StatusBadge>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Lines</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>SKU</TableHead>
                      <TableHead>External SKU</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Suggested / reserved unit</TableHead>
                      <TableHead>Fulfilled by</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(order.line_items ?? []).map((li) => (
                      <TableRow key={li.id}>
                        <TableCell className="font-mono">{li.sku || "—"}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{li.external_sku}</TableCell>
                        <TableCell className="font-mono tabular-nums">{li.qty}</TableCell>
                        <TableCell className="font-mono tabular-nums">{Number(li.price ?? 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell>
                          <SuggestedUnitCell orderId={id} orderStatus={order.status} lineItem={li} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={li.is_dropship ? "pending" : "neutral"}>
                            {li.is_dropship ? "Shipturtle" : "CDC"}
                          </StatusBadge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <FulfillmentCard order={order} />
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Customer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Name</p>
                  <p>{order.customer_name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Phone / Email</p>
                  <p className="text-xs">{order.customer_phone || order.customer_email || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Destination</p>
                  <p>
                    {order.shipping_city || "—"} {order.shipping_pincode ? `(${order.shipping_pincode})` : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Allocated location</p>
                  <p className="font-mono">{order.allocated_location || "—"}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {order.payment_status === "paid" ? "Paid" : "Order summary"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {[
                  ["Subtotal", order.order_summary?.subtotal],
                  ["Shipping", order.order_summary?.shipping],
                  ["Taxes", order.order_summary?.tax],
                  ["Discount", order.order_summary?.discount],
                ].map(([label, value]) =>
                  value == null ? null : (
                    <div key={label} className="flex items-center justify-between text-muted-foreground">
                      <span>{label}</span>
                      <span className="font-mono tabular-nums">{Number(value).toLocaleString("en-IN")}</span>
                    </div>
                  )
                )}
                <div className="flex items-center justify-between border-t border-border pt-1.5 font-medium">
                  <span>Total</span>
                  <span className="font-mono tabular-nums">
                    {Number(order.order_summary?.total ?? order.total_amount ?? 0).toLocaleString("en-IN")}
                  </span>
                </div>
                {order.order_summary?.paid != null && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Paid</span>
                    <span className="font-mono tabular-nums">
                      {Number(order.order_summary.paid).toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Order events</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Cancellations, returns and RTO all restock the same ledger — no separate pool.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(EVENT_MODES).map(([mode, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <Button
                      key={mode}
                      variant="outline"
                      className="w-full justify-start"
                      disabled={!canReverse}
                      onClick={() => setConfirmMode(mode)}
                    >
                      <Icon className="size-3.5" />
                      {cfg.label}
                    </Button>
                  );
                })}
                {!canReverse && (
                  <p className="pt-1 text-xs text-muted-foreground">
                    This order is already {order.status} — nothing left to change.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <AlertDialog open={Boolean(confirmMode)} onOpenChange={(open) => !open && setConfirmMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmMode && EVENT_MODES[confirmMode].label}?</AlertDialogTitle>
            <AlertDialogDescription>{confirmMode && EVENT_MODES[confirmMode].description}</AlertDialogDescription>
          </AlertDialogHeader>
          {eventError && (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{eventError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
            <Button variant="destructive" onClick={handleEvent} disabled={isPosting}>
              {isPosting ? "Working…" : confirmMode && EVENT_MODES[confirmMode].verb}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
