import { useState } from "react";
import { ArrowLeft, Ban, PackageCheck, RefreshCw, Undo2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { ChannelBadge } from "@/components/ChannelBadge.jsx";
import { EmptyState } from "@/components/empty-state.jsx";
import { StatusBadge } from "@/components/status-badge.jsx";
import {
  useGetOrderQuery,
  useGetSuggestedUnitQuery,
  usePostOrderEventMutation,
  useRefreshSuggestedUnitMutation,
} from "../api/services/orders.js";
import { formatApiError } from "../lib/errors.js";
import { reservationTone, SUGGESTION_HIDDEN_STATUSES } from "../lib/status.js";

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
                  <CardTitle className="font-mono text-base">{order.external_order_id}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{order.customer_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <ChannelBadge channel={order.channel} />
                  <StatusBadge tone={reservationTone(order.status)}>{order.status}</StatusBadge>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Location</p>
                  <p className="font-mono">{order.allocated_location || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">City / Pincode</p>
                  <p>
                    {order.shipping_city || "—"} {order.shipping_pincode ? `(${order.shipping_pincode})` : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Phone / Email</p>
                  <p className="text-xs">{order.customer_phone || order.customer_email || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Total</p>
                  <p className="font-mono">{Number(order.total_amount ?? 0).toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Discount</p>
                  <p className="font-mono">{Number(order.discount_amount ?? 0).toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Placed</p>
                  <p className="font-mono">{new Date(order.created_at).toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Line items</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>SKU</TableHead>
                      <TableHead>External SKU</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Reservation</TableHead>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card className="h-fit">
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
