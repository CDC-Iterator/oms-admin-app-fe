import { RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { cn } from "@/lib/utils";
import { BreakdownRow, Delta, MetricCard, Panel, WeekChart } from "../components/dashboard.jsx";
import { useGetOperationsDashboardQuery } from "../api/services/reports.js";
import { formatApiError } from "../lib/errors.js";
import { formatPlacedDate } from "../lib/utils.js";

const SHIPMENT_STATUS_TONE = { created: "text-muted-foreground", in_transit: "text-primary", delivered: "text-emerald-600", rto: "text-destructive", cancelled: "text-muted-foreground" };

export default function OperationsDashboard() {
  const { data, isFetching, isLoading, error, refetch } = useGetOperationsDashboardQuery(undefined, { pollingInterval: 60000 });

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        Couldn't load the dashboard — {formatApiError(error)}.{" "}
        <Button size="sm" variant="outline" onClick={refetch}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          What needs doing at your locations{data ? ` · refreshed ${new Date(data.as_of).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : ""}
        </p>
        <Button size="sm" variant="outline" onClick={refetch} disabled={isFetching}>
          <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.cards.map((card) => <MetricCard key={card.key} card={card} />)}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Shipments over time" className="lg:col-span-2">
              <div className="mb-1 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-semibold tabular-nums">{data.shipped_over_time.total}</span>
                <Delta value={data.shipped_over_time.delta} />
                <span className="text-xs text-muted-foreground">this week vs last week</span>
              </div>
              <WeekChart data={data.shipped_over_time} className="-mx-4 w-auto" />
              <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-primary" /> This week</span>
                <span className="flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-primary/50" /> Last week</span>
              </div>
            </Panel>

            <Panel title="Shipments, last 30 days">
              <div className="space-y-0.5">
                {data.shipment_breakdown.rows.map((r, i) => (
                  <BreakdownRow key={r.status} value={r.count} delta={r.delta} shaded={i % 2 === 1}>
                    <span className={SHIPMENT_STATUS_TONE[r.status]}>{r.label}</span>
                  </BreakdownRow>
                ))}
                <BreakdownRow value={data.shipment_breakdown.total} delta={data.shipment_breakdown.delta} shaded={data.shipment_breakdown.rows.length % 2 === 1}>
                  <span className="font-medium">Total</span>
                </BreakdownRow>
              </div>
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Oldest unshipped" className="lg:col-span-2">
              {data.oldest_unshipped.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing waiting — everything with a confirmed unit has shipped.</p>
              ) : (
                <div className="space-y-0.5">
                  {data.oldest_unshipped.map((r, i) => (
                    <Link key={`${r.order_id}-${r.item_code}-${i}`} to={`/orders/${r.order_id}`} className={cn("flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm hover:bg-muted", i % 2 === 1 && "bg-muted/60")}>
                      <span className="min-w-0 truncate">
                        <span className="font-mono text-xs text-primary">{r.order_name}</span>
                        <span className="ml-2 text-muted-foreground">{r.title}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{r.location} · {formatPlacedDate(r.placed_at)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>

            <div className="space-y-4">
              <Panel title="To ship by location">
                {data.to_ship_by_location.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing to ship.</p>
                ) : (
                  <div className="space-y-0.5">
                    {data.to_ship_by_location.map((l, i) => (
                      <Link key={l.location} to={`/fulfillments?location_id=${l.location_id}`} className="block rounded-lg hover:bg-muted">
                        <BreakdownRow value={l.count} shaded={i % 2 === 1}>{l.location}</BreakdownRow>
                      </Link>
                    ))}
                  </div>
                )}
              </Panel>
              <Panel title="Stock at your locations">
                <div className="space-y-0.5">
                  <BreakdownRow value={data.stock.low_stock_skus}>Low stock SKUs (under 10)</BreakdownRow>
                  <BreakdownRow value={data.stock.in_transit_units} shaded>Units in transit</BreakdownRow>
                </div>
              </Panel>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
