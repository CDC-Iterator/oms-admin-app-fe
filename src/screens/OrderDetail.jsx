import { useEffect, useState } from "react";
import { ArrowLeft, Ban, RefreshCw, Undo2 } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

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
import { Label } from "@/components/ui/label.jsx";
import { Select } from "@/components/ui/select.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { ChannelBadge } from "@/components/ChannelBadge.jsx";
import { EmptyState } from "@/components/empty-state.jsx";
import { OrderAppBar } from "../components/OrderAppBar.jsx";
import { OrderLinesSection } from "../components/OrderLinesSection.jsx";
import { PaymentSummaryCard } from "../components/PaymentSummaryCard.jsx";
import { StatusBadge } from "@/components/status-badge.jsx";
import { LineActionDialog } from "@/components/LineActionDialog.jsx";
import { LineActionsCard } from "@/components/LineActionsCard.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useToast } from "../hooks/useToast.js";
import {
  useGetOrderQuery,
  useGetSuggestedUnitQuery,
  usePostOrderEventMutation,
  useRefreshSuggestedUnitMutation,
} from "../api/services/orders.js";
import {
  useCreateManualShipmentMutation,
  useCreateShipmentMutation,
  useGetShipmentsQuery,
  useUpdateShipmentMutation,
} from "../api/services/fulfilment.js";
import { formatApiError } from "../lib/errors.js";
import { formatPlacedDate } from "../lib/utils.js";
import {
  fulfillmentTone,
  paymentTone,
  reservationTone,
  SUGGESTION_HIDDEN_STATUSES,
} from "../lib/status.js";

// Mirrors the backend's REQUIRE_CONFIRMED_UNIT_FOR_SHIPMENT (config/
// settings/base.py) — defaults off since production has no confirmed
// units yet; flip both once the POS confirm flow is proven.
const REQUIRE_CONFIRMED_UNIT = import.meta.env.VITE_REQUIRE_CONFIRMED_UNIT === "true";

// Every Shipment.TrackingEventStatus value (apps/fulfilment/models.py),
// for displaying last_reported_tracking_event_status — the persistent
// record of the last milestone actually pushed to Shopify.
const TRACKING_EVENT_LABELS = {
  CONFIRMED: "Confirmed",
  LABEL_PURCHASED: "Label purchased",
  LABEL_PRINTED: "Label printed",
  CARRIER_PICKED_UP: "Picked up by carrier",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  ATTEMPTED_DELIVERY: "Attempted delivery",
  DELAYED: "Delayed",
  READY_FOR_PICKUP: "Ready for pickup",
  FAILURE: "Failure",
};

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

// Shipment.Courier choices (apps/fulfilment/models.py) — "manual" first
// since it's the one with no parcel dimensions to fill in.
const COURIER_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "shipway", label: "Shipway" },
  { value: "shipdelight", label: "Shipdelight" },
  { value: "quicklee", label: "Quicklee" },
];
const COURIER_LABELS = Object.fromEntries(COURIER_OPTIONS.map((o) => [o.value, o.label]));

// One `form` object, same shape regardless of courier — only the fields
// a given courier's branch in handleSubmit actually reads get sent.
const EMPTY_SHIPMENT_FORM = {
  courier: "manual",
  awb: "",
  carrierName: "",
  trackingUrl: "",
  weightKg: "",
  lengthCm: "",
  breadthCm: "",
  heightCm: "",
  shipmentStatus: "created",
  trackingEventStatus: "",
};

// Hidden for now, coming back later — logic/dialog stay wired up, only
// the card itself (and its disabled state) is suppressed.
const ORDER_EVENTS_ENABLED = false;

const EVENT_MODES = {
  cancelled: { label: "Cancel order", verb: "Cancel", icon: Ban, description: "The reserved unit is released back into the ledger. This can't be undone." },
  returned: { label: "Mark returned", verb: "Return", icon: Undo2, description: "The unit rejoins the same ledger it left — availability corrects across every channel." },
};

// Groups the Lines card the way Shopify's own order page does — one
// section per Shipment (its own status/AWB/lines), plus a leading
// "Unfulfilled" section for whatever's left. A partially-shipped line
// appears in both, split by qty, not just wherever it happens to sit.
// `li.shipments` (OrderLineItemSerializer) already carries {id, courier,
// carrier_name, status, qty} per shipment covering that line.
function groupLinesByShipment(lineItems, channelFulfillments = []) {
  const unfulfilled = { key: "unfulfilled", shipmentRef: null, channelRef: null, entries: [] };
  const byShipmentId = new Map();

  for (const li of lineItems) {
    const refs = li.shipments ?? [];
    const shippedQty = refs.reduce((sum, s) => sum + s.qty, 0);
    // Units the sales channel (Shopify) already shows as fulfilled outside the OMS's own shipments.
    const remaining = li.qty - shippedQty - (li.channel_fulfilled_qty ?? 0);
    if (remaining > 0) {
      unfulfilled.entries.push({ line: li, qty: remaining });
    }
    for (const ref of refs) {
      if (!byShipmentId.has(ref.id)) {
        byShipmentId.set(ref.id, { key: `shipment-${ref.id}`, shipmentRef: ref, channelRef: null, entries: [] });
      }
      byShipmentId.get(ref.id).entries.push({ line: li, qty: ref.qty });
    }
  }

  const shipmentGroups = [...byShipmentId.values()].sort((a, b) => a.shipmentRef.id - b.shipmentRef.id);
  const linesById = new Map(lineItems.map((li) => [li.id, li]));
  const channelGroups = channelFulfillments.map((f) => ({
    key: `channel-${f.id}`,
    shipmentRef: null,
    channelRef: f,
    entries: f.line_items.map(({ line_item, qty }) => ({ line: linesById.get(line_item), qty })).filter((e) => e.line),
  }));
  const fulfilledGroups = [...shipmentGroups, ...channelGroups];
  // Units taken off the order on the channel (an edit or a cancellation) — Shopify lists them under "Removed".
  const removedEntries = lineItems.filter((li) => (li.removed_qty ?? 0) > 0).map((li) => ({ line: li, qty: li.removed_qty }));
  const removed = removedEntries.length > 0 ? [{ key: "removed", removed: true, shipmentRef: null, channelRef: null, entries: removedEntries }] : [];
  return [...(unfulfilled.entries.length > 0 ? [unfulfilled] : []), ...fulfilledGroups, ...removed];
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

// One combined box suggestion across every selected line's own Packaging
// (Product.packaging, apps/catalog) — max per dimension, not a sum, since
// items share one physical box rather than stacking their boxes end to
// end. Lines with no packaging assigned yet are just skipped.
function suggestPackagingDims(shippableLines) {
  const packagings = shippableLines.map((li) => li.packaging).filter(Boolean);
  if (packagings.length === 0) return null;
  return {
    length_cm: Math.max(...packagings.map((p) => Number(p.length_cm))),
    breadth_cm: Math.max(...packagings.map((p) => Number(p.breadth_cm))),
    height_cm: Math.max(...packagings.map((p) => Number(p.height_cm))),
  };
}

// Create/edit modal for a single shipment. `shipment` present → edit
// (courier/line items fixed, only carrier details + status change);
// `shipment` absent → create (manual courier only). `shippableLines` in
// create mode is the *already-made* selection from the Lines card's own
// checkboxes — this dialog just confirms/books it, it isn't a picker.
function ShipmentDialog({ orderId, shipment, shippableLines, availableCouriers, open, onOpenChange, onCreated }) {
  // Only couriers the order's allocated_location is actually configured for
  // (warehouse_id/address on file) — "manual" always qualifies.
  const courierOptions = COURIER_OPTIONS.filter((o) => (availableCouriers ?? ["manual"]).includes(o.value));
  const isEditing = Boolean(shipment);
  // Delivered is terminal — the shipment as it stood when the dialog
  // opened, never the in-progress dropdown pick, or setting *to* delivered
  // would lock the form before the save that gets it there.
  const isLocked = isEditing && shipment?.status === "delivered";
  const [createManualShipment, { isLoading: isCreating }] = useCreateManualShipmentMutation();
  const [createShipment, { isLoading: isBooking }] = useCreateShipmentMutation();
  const [updateShipment, { isLoading: isUpdating }] = useUpdateShipmentMutation();
  const isSaving = isCreating || isBooking || isUpdating;
  const { showToast } = useToast();

  const [form, setForm] = useState(EMPTY_SHIPMENT_FORM);
  const [formError, setFormError] = useState(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // isEditing only ever targets a manual shipment (the Lines card's pencil
  // icon is gated on that, below) — "courier" only matters for create mode.
  const isIntegratedCourier = !isEditing && form.courier !== "manual";

  // Re-seed the form from `shipment` (or blank, for create) each time the
  // dialog opens — a plain useState initializer only runs once per mount.
  // weightKg/dims are pre-filled suggestions (Shopify's per-line
  // weight_grams; each line's own Packaging for L/B/H) — still plain
  // editable fields, not read-only, since the packed box can legitimately
  // differ from either source.
  useEffect(() => {
    if (!open) return;
    const suggestedGrams = shippableLines.reduce((sum, li) => sum + (li.weight_grams ?? 0) * li.remaining, 0);
    const suggestedDims = suggestPackagingDims(shippableLines);
    setForm({
      ...EMPTY_SHIPMENT_FORM,
      weightKg: suggestedGrams > 0 ? String(Math.round((suggestedGrams / 1000) * 100) / 100) : "",
      lengthCm: suggestedDims ? String(suggestedDims.length_cm) : "",
      breadthCm: suggestedDims ? String(suggestedDims.breadth_cm) : "",
      heightCm: suggestedDims ? String(suggestedDims.height_cm) : "",
      awb: shipment?.awb_number ?? "",
      carrierName: shipment?.carrier_name ?? "",
      trackingUrl: shipment?.tracking_url ?? "",
      shipmentStatus: shipment?.status ?? "created",
      trackingEventStatus: shipment?.tracking_event_status ?? "",
    });
    setFormError(null);
  }, [open, shipment, shippableLines]);

  // The option list re-derives from the *current* status on every render
  // — picking "In transit" from the "created" stage's list re-renders with
  // the "in_transit" stage's own (different, more specific) options.
  const updateOptions = SHIPMENT_UPDATE_OPTIONS_BY_STAGE[form.shipmentStatus] ?? [];
  const selectedUpdateKey =
    updateOptions.find((o) => o.status === form.shipmentStatus && o.trackingEventStatus === form.trackingEventStatus)
      ?.key ??
    updateOptions[0]?.key ??
    "";

  const handleUpdateChange = (key) => {
    const option = updateOptions.find((o) => o.key === key);
    if (!option) return;
    setForm((f) => ({ ...f, shipmentStatus: option.status, trackingEventStatus: option.trackingEventStatus }));
  };

  const handleSubmit = async () => {
    setFormError(null);
    try {
      if (isEditing) {
        await updateShipment({
          orderId,
          shipmentId: shipment.id,
          awb_number: form.awb,
          carrier_name: form.carrierName,
          tracking_url: form.trackingUrl,
          status: form.shipmentStatus,
          tracking_event_status: form.trackingEventStatus,
        }).unwrap();
      } else if (form.courier === "manual") {
        await createManualShipment({
          orderId,
          awb_number: form.awb,
          carrier_name: form.carrierName,
          tracking_url: form.trackingUrl || undefined,
          line_items: shippableLines.map((li) => ({ line_item: li.id, qty: li.remaining })),
        }).unwrap();
        onCreated?.();
      } else {
        // 202 Accepted — create_shipment runs the real courier call async
        // (apps.fulfilment.tasks), so no Shipment row exists to show yet.
        await createShipment({
          orderId,
          courier: form.courier,
          line_items: shippableLines.map((li) => ({ line_item: li.id, qty: li.remaining })),
          weight_kg: Number(form.weightKg),
          length_cm: form.lengthCm ? Number(form.lengthCm) : undefined,
          breadth_cm: form.breadthCm ? Number(form.breadthCm) : undefined,
          height_cm: form.heightCm ? Number(form.heightCm) : undefined,
        }).unwrap();
        onCreated?.();
        showToast(
          `Booking with ${COURIER_LABELS[form.courier]} is in progress — it'll appear here once the courier confirms.`
        );
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
                  <span className="font-medium">{TERMINAL_STAGE_LABELS[form.shipmentStatus] ?? form.shipmentStatus}</span>.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <Label htmlFor="shipment-courier">Courier</Label>
                <Select id="shipment-courier" value={form.courier} onChange={set("courier")}>
                  {courierOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1 rounded-lg border border-border p-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">Shipping</p>
                {shippableLines.map((li) => (
                  <div key={li.id} className="flex items-center justify-between text-sm">
                    <span className="min-w-0 truncate text-xs" title={li.external_sku}>
                      {li.title || li.external_sku}
                      {li.variant_title && <span className="text-muted-foreground"> · {li.variant_title}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{li.remaining} unit(s)</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {(isEditing || form.courier === "manual") && (
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="AWB number" value={form.awb} onChange={set("awb")} disabled={isLocked} />
              <Input
                placeholder="Carrier name"
                value={form.carrierName}
                onChange={set("carrierName")}
                disabled={isLocked}
              />
              <Input
                placeholder="Tracking URL (optional)"
                className="col-span-2"
                value={form.trackingUrl}
                onChange={set("trackingUrl")}
                disabled={isLocked}
              />
            </div>
          )}

          {isIntegratedCourier && (
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Weight (kg)"
                className="col-span-2"
                value={form.weightKg}
                onChange={set("weightKg")}
              />
              {(form.weightKg || form.lengthCm) && (
                <p className="col-span-2 -mt-1 text-xs text-muted-foreground">
                  Weight suggested from the order's own item weights, box size from each item's packaging —
                  adjust for the actual packed box.
                </p>
              )}
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Length (cm, optional)"
                value={form.lengthCm}
                onChange={set("lengthCm")}
              />
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Breadth (cm, optional)"
                value={form.breadthCm}
                onChange={set("breadthCm")}
              />
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Height (cm, optional)"
                value={form.heightCm}
                onChange={set("heightCm")}
              />
            </div>
          )}

          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={
              isLocked ||
              isSaving ||
              (!isEditing && shippableLines.length === 0) ||
              (isEditing || form.courier === "manual"
                ? !form.awb || !form.carrierName
                : !(Number(form.weightKg) > 0))
            }
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
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.is_superuser || user?.role === "admin";
  const { data: order, isFetching, error, refetch } = useGetOrderQuery(id);
  const [postEvent, { isLoading: isPosting }] = usePostOrderEventMutation();
  const [confirmMode, setConfirmMode] = useState(null);
  const [eventError, setEventError] = useState(null);
  // { orderId, line, action } while the per-line cancel/return dialog is open.
  const [lineActionTarget, setLineActionTarget] = useState(null);

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
            (li) =>
              !li.is_dropship &&
              (!REQUIRE_CONFIRMED_UNIT || li.is_fully_confirmed) &&
              li.qty - (shippedByLine[li.id] ?? 0) - (li.channel_fulfilled_qty ?? 0) > 0
          )
          .map((li) => li.id)
      : []
  );
  const selectedShippableLines = lineItems
    .filter((li) => selectedLineIds.has(li.id))
    .map((li) => ({ ...li, remaining: li.qty - (shippedByLine[li.id] ?? 0) - (li.channel_fulfilled_qty ?? 0) }));
  const shipmentById = new Map((shipments ?? []).map((s) => [s.id, s]));
  const lineGroups = groupLinesByShipment(lineItems, order?.channel_fulfillments ?? []);

  // Prev/next only when opened from the list (it passes the visible page's ids in router state).
  const listIds = location.state?.orderIds;
  const listIndex = Array.isArray(listIds) ? listIds.indexOf(Number(id)) : -1;
  const neighbourId = (step) => {
    const target = listIndex >= 0 ? listIds[listIndex + step] : undefined;
    return target === undefined ? undefined : () => navigate(`/orders/${target}`, { state: { orderIds: listIds } });
  };

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
      {order ? (
        <OrderAppBar
          order={order}
          onBack={() => navigate("/orders")}
          onPrev={neighbourId(-1)}
          onNext={neighbourId(1)}
          actions={
            ORDER_EVENTS_ENABLED
              ? Object.entries(EVENT_MODES).map(([mode, cfg]) => ({
                  key: mode,
                  label: cfg.label,
                  icon: cfg.icon,
                  destructive: mode === "cancelled",
                  disabled: !canReverse,
                  onSelect: () => setConfirmMode(mode),
                }))
              : []
          }
        />
      ) : (
        <Button variant="ghost" size="sm" className="mb-2" onClick={() => navigate("/orders")}>
          <ArrowLeft className="size-3.5" />
          Back to orders
        </Button>
      )}

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
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <Card size="sm">
              <CardHeader>
                <CardTitle className="font-mono text-sm" title={order.external_order_id}>
                  {order.order_name || order.external_order_id}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Placed {formatPlacedDate(order.placed_at ?? order.created_at)}
                </p>
                <CardAction className="flex flex-wrap items-center gap-1.5">
                  <ChannelBadge channel={order.channel} className="status-chip--compact" />
                  <StatusBadge tone={reservationTone(order.status)} className="status-chip--compact">{order.status}</StatusBadge>
                  {order.payment_status && (
                    <StatusBadge tone={paymentTone(order.payment_status)} className="status-chip--compact">{order.payment_status}</StatusBadge>
                  )}
                  <StatusBadge tone={fulfillmentTone(order.fulfillment_status)} className="status-chip--compact">{order.fulfillment_status}</StatusBadge>
                </CardAction>
              </CardHeader>
            </Card>

            <OrderLinesSection
              order={order}
              orderId={id}
              lineGroups={lineGroups}
              shipmentById={shipmentById}
              isAdmin={isAdmin}
              shippableLineIds={shippableLineIds}
              selectedLineIds={selectedLineIds}
              onToggleLine={toggleLineSelection}
              onBookShipment={() => setDialogTarget({})}
              onEditShipment={setDialogTarget}
              onLineAction={setLineActionTarget}
              renderUnit={(line) => <SuggestedUnitCell orderId={id} orderStatus={order.status} lineItem={line} />}
              trackingEventLabels={TRACKING_EVENT_LABELS}
            />

            <PaymentSummaryCard order={order} />

            <LineActionsCard lineItems={lineItems} isAdmin={isAdmin} />
          </div>

          <div className="space-y-3">
            <Card size="sm">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Customer</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-xs">
                  <dt className="text-[11px] text-muted-foreground uppercase">Name</dt>
                  <dd className="min-w-0 break-words">{order.customer_name || "—"}</dd>
                  <dt className="text-[11px] text-muted-foreground uppercase">Phone / Email</dt>
                  <dd className="min-w-0 break-words">{order.customer_phone || order.customer_email || "—"}</dd>
                  <dt className="text-[11px] text-muted-foreground uppercase">Destination</dt>
                  <dd className="min-w-0 break-words">
                    {order.shipping_city || "—"} {order.shipping_pincode ? `(${order.shipping_pincode})` : ""}
                  </dd>
                  <dt className="text-[11px] text-muted-foreground uppercase">Invoice ID</dt>
                  <dd className="min-w-0 break-words font-mono">{order.invoice_id || "—"}</dd>
                  <dt className="text-[11px] text-muted-foreground uppercase">Delivery</dt>
                  <dd className="min-w-0 break-words">{order.delivery_method || "—"}</dd>
                  <dt className="text-[11px] text-muted-foreground uppercase">Location</dt>
                  <dd className="min-w-0 break-words font-mono">{order.allocated_location || "—"}</dd>
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {isAdmin && order && (
        <ShipmentDialog
          orderId={order.id}
          shipment={dialogTarget && dialogTarget.id ? dialogTarget : null}
          shippableLines={dialogTarget && dialogTarget.id ? [] : selectedShippableLines}
          availableCouriers={order.available_couriers}
          open={Boolean(dialogTarget)}
          onOpenChange={(open) => !open && setDialogTarget(null)}
          onCreated={() => setSelectedLineIds(new Set())}
        />
      )}

      <LineActionDialog
        key={lineActionTarget ? `${lineActionTarget.line.id}-${lineActionTarget.action}` : "closed"}
        target={lineActionTarget}
        onClose={() => setLineActionTarget(null)}
      />

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
