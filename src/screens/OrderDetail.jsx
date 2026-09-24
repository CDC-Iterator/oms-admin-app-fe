import { useState } from "react";
import { ArrowLeft, Ban, PackageCheck, RefreshCw, Truck, Undo2 } from "lucide-react";
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
import { useCreateManualShipmentMutation, useGetShipmentsQuery } from "../api/services/fulfilment.js";
import { formatApiError } from "../lib/errors.js";
import { fulfillmentTone, paymentTone, reservationTone, SUGGESTION_HIDDEN_STATUSES } from "../lib/status.js";

const SHIPMENT_STATUS_TONE = {
  created: "pending",
  in_transit: "pending",
  delivered: "success",
  rto: "danger",
  cancelled: "danger",
};

// Only "manual" has a real connector today (CDC-78/79/80 — Shipway/
// Shipdelight/Quicklee — are stubs, apps/fulfilment/connectors/_stub.py).
const COURIER_OPTIONS = [
  { value: "manual", label: "Manual (AWB + carrier)", disabled: false },
  { value: "shipway", label: "Shipway — coming soon", disabled: true },
  { value: "shipdelight", label: "Shipdelight — coming soon", disabled: true },
  { value: "quicklee", label: "Quicklee — coming soon", disabled: true },
];

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

// Dedicated fulfillment/shipment creation — separate from the Lines card.
// Manual-only for now (see COURIER_OPTIONS above); shipment history is
// visible to any authenticated role, creation is admin-only (mirrors the
// backend's IsAdmin gate on both POST endpoints).
function FulfillmentCard({ order }) {
  const { user } = useAuth();
  const isAdmin = user?.is_superuser || user?.role === "admin";
  const orderId = order.id;
  const lineItems = order.line_items ?? [];

  const { data: shipments, isFetching, error, refetch } = useGetShipmentsQuery(orderId);
  const [createManualShipment, { isLoading: isCreating }] = useCreateManualShipmentMutation();

  const [courier, setCourier] = useState("manual");
  const [awb, setAwb] = useState("");
  const [carrierName, setCarrierName] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [qtyByLine, setQtyByLine] = useState({});
  const [formError, setFormError] = useState(null);

  const shippedByLine = {};
  for (const s of shipments ?? []) {
    for (const li of s.line_items) {
      shippedByLine[li.order_line_item] = (shippedByLine[li.order_line_item] ?? 0) + li.qty;
    }
  }
  const remaining = (li) => li.qty - (shippedByLine[li.id] ?? 0);

  const toggleLine = (li, checked) => {
    setQtyByLine((prev) => {
      const next = { ...prev };
      if (checked) {
        next[li.id] = remaining(li);
      } else {
        delete next[li.id];
      }
      return next;
    });
  };

  const selectedLineItems = Object.entries(qtyByLine).filter(([, qty]) => qty > 0);

  const handleSubmit = async () => {
    setFormError(null);
    try {
      await createManualShipment({
        orderId,
        awb_number: awb,
        carrier_name: carrierName,
        tracking_url: trackingUrl || undefined,
        line_items: selectedLineItems.map(([line_item, qty]) => ({ line_item: Number(line_item), qty })),
      }).unwrap();
      setAwb("");
      setCarrierName("");
      setTrackingUrl("");
      setQtyByLine({});
    } catch (err) {
      setFormError(formatApiError(err));
    }
  };

  const shippableLines = lineItems.filter((li) => remaining(li) > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Fulfillment</CardTitle>
        <p className="text-xs text-muted-foreground">Book a shipment and push tracking back to the channel.</p>
      </CardHeader>
      <CardContent className="space-y-4">
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
                <StatusBadge tone={SHIPMENT_STATUS_TONE[s.status] ?? "neutral"}>{s.status}</StatusBadge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No shipments booked yet.</p>
        )}

        {isAdmin && shippableLines.length > 0 && (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">Create shipment</p>

            <Select value={courier} onChange={(e) => setCourier(e.target.value)}>
              {COURIER_OPTIONS.map((c) => (
                <option key={c.value} value={c.value} disabled={c.disabled}>
                  {c.label}
                </option>
              ))}
            </Select>

            <div className="space-y-1.5">
              {shippableLines.map((li) => (
                <label key={li.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={li.id in qtyByLine}
                    onChange={(e) => toggleLine(li, e.target.checked)}
                  />
                  <span className="font-mono text-xs">{li.external_sku}</span>
                  <span className="text-xs text-muted-foreground">({remaining(li)} unshipped)</span>
                </label>
              ))}
            </div>

            {courier === "manual" && (
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
            )}

            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={
                isCreating || courier !== "manual" || selectedLineItems.length === 0 || !awb || !carrierName
              }
            >
              {isCreating ? "Booking…" : "Book shipment"}
            </Button>
          </div>
        )}
      </CardContent>
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
