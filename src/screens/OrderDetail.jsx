import { useState } from "react";
import { ArrowLeft, Ban, PackageCheck, Undo2 } from "lucide-react";
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
import { ChannelBadge } from "@/components/ChannelBadge.jsx";
import { EmptyState } from "@/components/empty-state.jsx";
import { StatusBadge } from "@/components/status-badge.jsx";
import { Timeline } from "@/components/Timeline.jsx";
import { useGetOrderQuery, useReverseOrderMutation } from "../api/services/orders.js";
import { formatApiError } from "../lib/errors.js";
import { reservationTone } from "../lib/status.js";

const REVERSE_MODES = {
  cancel: { label: "Cancel order", verb: "Cancel", icon: Ban, description: "The reserved unit is released back into the pool. This can't be undone." },
  return: { label: "Mark returned", verb: "Return", icon: Undo2, description: "The unit rejoins the same ledger it left — availability corrects across every channel." },
  rto: { label: "Mark RTO", verb: "RTO", icon: PackageCheck, description: "Return-to-origin: the unit restocks at its original location." },
};

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: order, isFetching, error, refetch } = useGetOrderQuery(id);
  const [reverseOrder, { isLoading: isReversing }] = useReverseOrderMutation();
  const [confirmMode, setConfirmMode] = useState(null);
  const [reverseError, setReverseError] = useState(null);

  const handleReverse = async () => {
    setReverseError(null);
    try {
      await reverseOrder({ id, mode: confirmMode }).unwrap();
      setConfirmMode(null);
    } catch (err) {
      setReverseError(formatApiError(err));
    }
  };

  const canReverse = order?.reservationStatus === "reserved";

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
                  <CardTitle className="font-mono text-base">{order.orderNumber}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{order.title}</p>
                </div>
                <div className="flex items-center gap-2">
                  <ChannelBadge channel={order.channel} />
                  <StatusBadge tone={reservationTone(order.reservationStatus)}>
                    {order.reservationStatus}
                  </StatusBadge>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Item code</p>
                  <p className="font-mono">{order.itemCode}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Serial</p>
                  <p className="font-mono">{order.barcode || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Customer</p>
                  <p>{order.customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Total</p>
                  <p className="font-mono">
                    {order.unitPrice?.toLocaleString("en-IN")} {order.currency}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Placed</p>
                  <p className="font-mono">{new Date(order.placedAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Payment</p>
                  <StatusBadge tone="success">{order.financialStatus}</StatusBadge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <Timeline events={order.timeline} />
              </CardContent>
            </Card>
          </div>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Reverse flows</CardTitle>
              <p className="text-xs text-muted-foreground">
                Cancellations, returns and RTO all restock the same pool — no separate ledger.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(REVERSE_MODES).map(([mode, cfg]) => {
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
                  This order is already {order.reservationStatus} — nothing left to reverse.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <AlertDialog open={Boolean(confirmMode)} onOpenChange={(open) => !open && setConfirmMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmMode && REVERSE_MODES[confirmMode].label}?</AlertDialogTitle>
            <AlertDialogDescription>{confirmMode && REVERSE_MODES[confirmMode].description}</AlertDialogDescription>
          </AlertDialogHeader>
          {reverseError && (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{reverseError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
            <Button variant="destructive" onClick={handleReverse} disabled={isReversing}>
              {isReversing ? "Working…" : confirmMode && REVERSE_MODES[confirmMode].verb}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
