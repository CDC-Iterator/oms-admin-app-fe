import { useEffect, useState } from "react";
import { ArrowLeft, Ban, PackageCheck, Pencil, Plus, RefreshCw, Undo2 } from "lucide-react";
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
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card.jsx";
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
import {
  fulfillmentTone,
  paymentTone,
  reservationTone,
  shipmentTone,
  SUGGESTION_HIDDEN_STATUSES,
} from "../lib/status.js";

// One "what actually happened to this shipment" dropdown, not two — each
// option carries both the coarse Shipment.Status to set and (where it's
// more specific than that) the exact Shopify FulfillmentEventStatus to
// report for it (Shipment.tracking_event_status). Keyed by the shipment's
// *current* status, so the list re-derives to the next stage's options
// the moment a stage-changing option is picked — never all 11 milestones
// at once, and never a step backwards.
const SHIPMENT_UPDATE_OPTIONS_BY_STAGE = {
  created: [
    { key: "created", label: "Created", status: "created", trackingEventStatus: "" },
    { key: "confirmed", label: "Confirmed", status: "created", trackingEventStatus: "CONFIRMED" },
    { key: "label_purchased", label: "Label purchased", status: "created", trackingEventStatus: "LABEL_PURCHASED" },
    { key: "label_printed", label: "Label printed", status: "created", trackingEventStatus: "LABEL_PRINTED" },
    { key: "carrier_picked_up", label: "Picked up by carrier", status: "created", trackingEventStatus: "CARRIER_PICKED_UP" },
    { key: "ready_for_pickup", label: "Ready for pickup", status: "created", trackingEventStatus: "READY_FOR_PICKUP" },
    { key: "delayed", label: "Delayed", status: "created", trackingEventStatus: "DELAYED" },
    { key: "in_transit", label: "In transit", status: "in_transit", trackingEventStatus: "" },
    { key: "cancelled", label: "Cancelled", status: "cancelled", trackingEventStatus: "" },
  ],
  in_transit: [
    { key: "in_transit", label: "In transit", status: "in_transit", trackingEventStatus: "" },
    { key: "out_for_delivery", label: "Out for delivery", status: "in_transit", trackingEventStatus: "OUT_FOR_DELIVERY" },
    { key: "attempted_delivery", label: "Attempted delivery", status: "in_transit", trackingEventStatus: "ATTEMPTED_DELIVERY" },
    { key: "delayed", label: "Delayed", status: "in_transit", trackingEventStatus: "DELAYED" },
    { key: "delivered", label: "Delivered", status: "delivered", trackingEventStatus: "" },
    { key: "rto", label: "RTO / delivery failed", status: "rto", trackingEventStatus: "" },
    { key: "cancelled", label: "Cancelled", status: "cancelled", trackingEventStatus: "" },
  ],
};

// delivered/rto/cancelled have no further sub-choice (terminal) — shown
// as a plain confirmation line instead of a one-item/empty dropdown.
const TERMINAL_STAGE_LABELS = { delivered: "Delivered", rto: "RTO / delivery failed", cancelled: "Cancelled" };

// Hidden for now, coming back later — logic/dialog stay wired up, only
// the card itself (and its disabled state) is suppressed.
const ORDER_EVENTS_ENABLED = false;

const EVENT_MODES = {
  cancelled: { label: "Cancel order", verb: "Cancel", icon: Ban, description: "The reserved unit is released back into the ledger. This can't be undone." },
  returned: { label: "Mark returned", verb: "Return", icon: Undo2, description: "The unit rejoins the same ledger it left — availability corrects across every channel." },
  rto: { label: "Mark RTO", verb: "RTO", icon: PackageCheck, description: "Return-to-origin: the unit restocks at its original location." },
};

// Groups the Lines card the way Shopify's own order page does — one
// section per Shipment (its own status/AWB/lines), plus a leading
// "Unfulfilled" section for whatever's left. A partially-shipped line
// appears in both, split by qty, not just wherever it happens to sit.
// `li.shipments` (OrderLineItemSerializer) already carries {id, courier,
// carrier_name, status, qty} per shipment covering that line.
function groupLinesByShipment(lineItems) {
  const unfulfilled = { key: "unfulfilled", shipmentRef: null, entries: [] };
  const byShipmentId = new Map();

  for (const li of lineItems) {
    const refs = li.shipments ?? [];
    const shippedQty = refs.reduce((sum, s) => sum + s.qty, 0);
    const remaining = li.qty - shippedQty;
    if (remaining > 0) {
      unfulfilled.entries.push({ line: li, qty: remaining });
    }
    for (const ref of refs) {
      if (!byShipmentId.has(ref.id)) {
        byShipmentId.set(ref.id, { key: `shipment-${ref.id}`, shipmentRef: ref, entries: [] });
      }
      byShipmentId.get(ref.id).entries.push({ line: li, qty: ref.qty });
    }
  }

  const shipmentGroups = [...byShipmentId.values()].sort((a, b) => a.shipmentRef.id - b.shipmentRef.id);
  return unfulfilled.entries.length > 0 ? [unfulfilled, ...shipmentGroups] : shipmentGroups;
}

// A line's `qty` can need more than one physical unit (many-to-many
// unit assignment) — `confirmed_units`/`suggested_units` are barcode
// lists, `is_fully_confirmed` is the "every slot confirmed" gate.
function SuggestedUnitCell({ orderId, orderStatus, lineItem }) {
  const confirmedUnits = lineItem.confirmed_units ?? [];
  const fullyConfirmed = lineItem.is_fully_confirmed;
  const showSuggestion = !SUGGESTION_HIDDEN_STATUSES.has(orderStatus);
  const { data, isFetching } = useGetSuggestedUnitQuery(
    { orderId, lineItemId: lineItem.id },
    { skip: fullyConfirmed || !showSuggestion }
  );
  const [refresh, { isLoading: isRefreshing }] = useRefreshSuggestedUnitMutation();

  if (fullyConfirmed) {
    return <StatusBadge tone="success">Confirmed · {confirmedUnits.join(", ")}</StatusBadge>;
  }
  if (!showSuggestion) {
    return <span className="text-xs text-muted-foreground">No unit assigned</span>;
  }
  if (isFetching) return <Skeleton className="h-5 w-24" />;

  const units = data?.suggested_inventory_units ?? [];
  if (units.length === 0) {
    return <span className="text-xs text-muted-foreground">No suggestion yet</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {units.map((unit) => (
        <StatusBadge key={unit.id} tone={unit.stale ? "danger" : "pending"}>
          {unit.barcode} @ {unit.location}
          {unit.stale ? " (stale)" : ""}
        </StatusBadge>
      ))}
      {units.some((unit) => unit.stale) && (
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
// `shipment` absent → create (manual courier only). `shippableLines` in
// create mode is the *already-made* selection from the Lines card's own
// checkboxes — this dialog just confirms/books it, it isn't a picker.
function ShipmentDialog({ orderId, shipment, shippableLines, open, onOpenChange, onCreated }) {
  const isEditing = Boolean(shipment);
  // Delivered is terminal — the shipment as it stood when the dialog
  // opened, never the in-progress dropdown pick, or setting *to* delivered
  // would lock the form before the save that gets it there.
  const isLocked = isEditing && shipment?.status === "delivered";
  const [createManualShipment, { isLoading: isCreating }] = useCreateManualShipmentMutation();
  const [updateShipment, { isLoading: isUpdating }] = useUpdateShipmentMutation();
  const isSaving = isCreating || isUpdating;

  const [awb, setAwb] = useState("");
  const [carrierName, setCarrierName] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [shipmentStatus, setShipmentStatus] = useState("created");
  const [trackingEventStatus, setTrackingEventStatus] = useState("");
  const [formError, setFormError] = useState(null);

  // Re-seed the form from `shipment` (or blank, for create) each time the
  // dialog opens — a plain useState initializer only runs once per mount.
  useEffect(() => {
    if (!open) return;
    setAwb(shipment?.awb_number ?? "");
    setCarrierName(shipment?.carrier_name ?? "");
    setTrackingUrl(shipment?.tracking_url ?? "");
    setShipmentStatus(shipment?.status ?? "created");
    setTrackingEventStatus(shipment?.tracking_event_status ?? "");
    setFormError(null);
  }, [open, shipment]);

  // The option list re-derives from the *current* status on every render
  // — picking "In transit" from the "created" stage's list re-renders with
  // the "in_transit" stage's own (different, more specific) options.
  const updateOptions = SHIPMENT_UPDATE_OPTIONS_BY_STAGE[shipmentStatus] ?? [];
  const selectedUpdateKey =
    updateOptions.find((o) => o.status === shipmentStatus && o.trackingEventStatus === trackingEventStatus)?.key ??
    updateOptions[0]?.key ??
    "";

  const handleUpdateChange = (key) => {
    const option = updateOptions.find((o) => o.key === key);
    if (!option) return;
    setShipmentStatus(option.status);
    setTrackingEventStatus(option.trackingEventStatus);
  };

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
          tracking_event_status: trackingEventStatus,
        }).unwrap();
      } else {
        await createManualShipment({
          orderId,
          awb_number: awb,
          carrier_name: carrierName,
          tracking_url: trackingUrl || undefined,
          line_items: shippableLines.map((li) => ({ line_item: li.id, qty: li.remaining })),
        }).unwrap();
        onCreated?.();
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
          {isLocked && (
            <Alert>
              <AlertDescription>This shipment has been delivered — no further changes.</AlertDescription>
            </Alert>
          )}

          {isEditing ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Latest update</p>
              {updateOptions.length > 0 ? (
                <Select value={selectedUpdateKey} onChange={(e) => handleUpdateChange(e.target.value)} disabled={isLocked}>
                  {updateOptions.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <p className="text-sm">
                  Setting status to{" "}
                  <span className="font-medium">{TERMINAL_STAGE_LABELS[shipmentStatus] ?? shipmentStatus}</span>.
                </p>
              )}
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Courier: <span className="font-medium text-foreground">Manual</span> — Shipway/Shipdelight/Quicklee
                are coming soon.
              </p>

              <div className="space-y-1 rounded-lg border border-border p-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">Shipping</p>
                {shippableLines.map((li) => (
                  <div key={li.id} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs">{li.external_sku}</span>
                    <span className="text-xs text-muted-foreground">{li.remaining} unit(s)</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="AWB number"
              value={awb}
              onChange={(e) => setAwb(e.target.value)}
              disabled={isLocked}
            />
            <Input
              placeholder="Carrier name"
              value={carrierName}
              onChange={(e) => setCarrierName(e.target.value)}
              disabled={isLocked}
            />
            <Input
              placeholder="Tracking URL (optional)"
              className="col-span-2"
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              disabled={isLocked}
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
            disabled={isLocked || isSaving || !awb || !carrierName || (!isEditing && shippableLines.length === 0)}
          >
            {isSaving ? "Saving…" : isEditing ? "Save changes" : "Book shipment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.is_superuser || user?.role === "admin";
  const { data: order, isFetching, error, refetch } = useGetOrderQuery(id);
  const [postEvent, { isLoading: isPosting }] = usePostOrderEventMutation();
  const [confirmMode, setConfirmMode] = useState(null);
  const [eventError, setEventError] = useState(null);

  const { data: shipments } = useGetShipmentsQuery(order?.id, { skip: !order });

  // null closed; {} create (books the Lines card's checked selection);
  // a real Shipment object = edit (a shipment group's own pencil icon
  // in the Lines card, manual couriers only).
  const [dialogTarget, setDialogTarget] = useState(null);
  const [selectedLineIds, setSelectedLineIds] = useState(() => new Set());

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

  const lineItems = order?.line_items ?? [];
  const shippedByLine = {};
  for (const s of shipments ?? []) {
    for (const sli of s.line_items) {
      shippedByLine[sli.order_line_item] = (shippedByLine[sli.order_line_item] ?? 0) + sli.qty;
    }
  }
  // We only ever book shipments for Shopify orders against CDC's own
  // stock: never dropship, never a channel other than Shopify, and every
  // unit on the line confirmed (not merely suggested) — not already
  // fully shipped.
  const isShopifyOrder = order?.channel === "shopify";
  const shippableLineIds = new Set(
    isShopifyOrder
      ? lineItems
          .filter(
            (li) => !li.is_dropship && li.is_fully_confirmed && li.qty - (shippedByLine[li.id] ?? 0) > 0
          )
          .map((li) => li.id)
      : []
  );
  const selectedShippableLines = lineItems
    .filter((li) => selectedLineIds.has(li.id))
    .map((li) => ({ ...li, remaining: li.qty - (shippedByLine[li.id] ?? 0) }));
  const shipmentById = new Map((shipments ?? []).map((s) => [s.id, s]));
  const lineGroups = groupLinesByShipment(lineItems);

  const toggleLineSelection = (lineId, checked) => {
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(lineId);
      else next.delete(lineId);
      return next;
    });
  };

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
              <CardHeader>
                <CardTitle className="font-mono text-base" title={order.external_order_id}>
                  {order.order_name || order.external_order_id}
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground font-mono">
                  Placed {new Date(order.created_at).toLocaleString()}
                </p>
                <CardAction className="flex flex-wrap items-center gap-1.5">
                  <ChannelBadge channel={order.channel} />
                  <StatusBadge tone={reservationTone(order.status)}>{order.status}</StatusBadge>
                  {order.payment_status && (
                    <StatusBadge tone={paymentTone(order.payment_status)}>{order.payment_status}</StatusBadge>
                  )}
                  <StatusBadge tone={fulfillmentTone(order.fulfillment_status)}>{order.fulfillment_status}</StatusBadge>
                </CardAction>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Lines</CardTitle>
                {isAdmin && selectedLineIds.size > 0 && (
                  <CardAction>
                    <Button size="sm" variant="outline" onClick={() => setDialogTarget({})}>
                      <Plus className="size-3.5" />
                      Book Shipment
                    </Button>
                  </CardAction>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {lineGroups.map((group) => {
                  const fullShipment = group.shipmentRef ? shipmentById.get(group.shipmentRef.id) : null;
                  const isManual = group.shipmentRef?.courier === "manual";
                  const showCheckboxColumn = !group.shipmentRef && isAdmin;
                  return (
                    <div key={group.key} className="overflow-hidden rounded-lg ring-1 ring-border">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
                        <div className="flex items-center gap-2">
                          {group.shipmentRef ? (
                            <StatusBadge tone={shipmentTone(group.shipmentRef.status)}>
                              {group.shipmentRef.status}
                            </StatusBadge>
                          ) : (
                            <span className="text-sm font-medium">Unfulfilled</span>
                          )}
                          {group.shipmentRef && (
                            <span className="text-xs text-muted-foreground capitalize">
                              {group.shipmentRef.carrier_name || group.shipmentRef.courier}
                            </span>
                          )}
                          {fullShipment?.awb_number && (
                            <span className="font-mono text-xs text-muted-foreground">
                              AWB {fullShipment.awb_number}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {order.allocated_location && (
                            <span className="text-xs text-muted-foreground">{order.allocated_location}</span>
                          )}
                          {isManual && isAdmin && fullShipment && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setDialogTarget(fullShipment)}
                              aria-label="Edit shipment"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            {showCheckboxColumn && <TableHead className="w-8" />}
                            <TableHead>SKU</TableHead>
                            <TableHead>External SKU</TableHead>
                            <TableHead>Qty</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Suggested / reserved unit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.entries.map(({ line, qty }) => (
                            <TableRow key={`${group.key}-${line.id}`}>
                              {showCheckboxColumn && (
                                <TableCell>
                                  {shippableLineIds.has(line.id) && (
                                    <input
                                      type="checkbox"
                                      checked={selectedLineIds.has(line.id)}
                                      onChange={(e) => toggleLineSelection(line.id, e.target.checked)}
                                      aria-label={`Select ${line.external_sku} for a shipment`}
                                    />
                                  )}
                                </TableCell>
                              )}
                              <TableCell className="font-mono">
                                {line.sku || "—"}
                                {line.is_dropship && (
                                  <StatusBadge tone="pending" className="ml-1.5">
                                    Shipturtle
                                  </StatusBadge>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {line.external_sku}
                              </TableCell>
                              <TableCell className="font-mono tabular-nums">{qty}</TableCell>
                              <TableCell className="font-mono tabular-nums">
                                {Number(line.price ?? 0).toLocaleString("en-IN")}
                              </TableCell>
                              <TableCell>
                                <SuggestedUnitCell orderId={id} orderStatus={order.status} lineItem={line} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
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

            {ORDER_EVENTS_ENABLED && (
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
            )}
          </div>
        </div>
      )}

      {isAdmin && order && (
        <ShipmentDialog
          orderId={order.id}
          shipment={dialogTarget && dialogTarget.id ? dialogTarget : null}
          shippableLines={dialogTarget && dialogTarget.id ? [] : selectedShippableLines}
          open={Boolean(dialogTarget)}
          onOpenChange={(open) => !open && setDialogTarget(null)}
          onCreated={() => setSelectedLineIds(new Set())}
        />
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
