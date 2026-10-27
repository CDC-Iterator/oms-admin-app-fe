import { ArrowDownRight, ArrowUpRight, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { cn } from "@/lib/utils";
import { useGetOperationsDashboardQuery } from "../api/services/reports.js";
import { formatApiError } from "../lib/errors.js";
import { formatPlacedDate } from "../lib/utils.js";

const SHIPMENT_STATUS_TONE = { created: "text-muted-foreground", in_transit: "text-primary", delivered: "text-emerald-600", rto: "text-destructive", cancelled: "text-muted-foreground" };

// A label with the dotted underline the analytics cards use.
function Label({ children }) {
  return <span className="border-b border-dotted border-muted-foreground/60 text-sm font-medium">{children}</span>;
}

// +12% / -8%. `inverted` flips the colour (more failures is bad).
function Delta({ value, inverted }) {
  if (value === null || value === undefined) return null;
  const up = value > 0;
  const good = value === 0 ? null : inverted ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", good === null ? "text-muted-foreground" : good ? "text-emerald-600" : "text-destructive")}>
      {value !== 0 && <Icon className="size-3" />}
      {Math.abs(value)}%
    </span>
  );
}

// Tiny line, no axes — the shape of the last N days.
function Sparkline({ series, className }) {
  if (!series || series.every((v) => v === 0)) return null;
  const w = 96;
  const h = 30;
  const max = Math.max(...series, 1);
  const points = series.map((v, i) => `${(i / (series.length - 1)) * w},${h - 3 - (v / max) * (h - 6)}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-8 w-24 shrink-0 text-primary", className)} aria-hidden>
      <polyline points={points.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function MetricCard({ card }) {
  const body = (
    <div className="flex h-full items-end justify-between gap-2 rounded-2xl bg-card p-4 shadow-xs ring-1 ring-border transition-colors hover:ring-foreground/20">
      <div className="min-w-0 space-y-1.5">
        <Label>{card.label}</Label>
        <div className="flex items-baseline gap-2">
          <span className={cn("font-mono text-2xl font-semibold tabular-nums", card.tone === "danger" && "text-destructive")}>
            {card.value.toLocaleString("en-IN")}
          </span>
          <Delta value={card.delta} inverted={card.delta_inverted} />
        </div>
      </div>
      <Sparkline series={card.series} />
    </div>
  );
  return card.link ? <Link to={card.link}>{body}</Link> : body;
}

// This week (solid) against last week (dotted), like the analytics line chart.
function WeekChart({ data }) {
  const w = 640;
  const h = 220;
  const pad = { l: 34, r: 10, t: 10, b: 24 };
  const max = Math.max(...data.this_week, ...data.last_week, 1);
  const x = (i) => pad.l + (i / (data.labels.length - 1)) * (w - pad.l - pad.r);
  const y = (v) => h - pad.b - (v / max) * (h - pad.t - pad.b);
  const path = (series) => series.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-56 w-full" role="img" aria-label="Shipments per day, this week against last week">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth="1" />
          <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">{t}</text>
        </g>
      ))}
      {data.labels.map((l, i) => (
        <text key={i} x={x(i)} y={h - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">{l}</text>
      ))}
      <path d={path(data.last_week)} fill="none" className="stroke-primary/40" strokeWidth="1.5" strokeDasharray="3 4" />
      <path d={path(data.this_week)} fill="none" className="stroke-primary" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.this_week.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="2.5" className="fill-primary" />
      ))}
    </svg>
  );
}

function Panel({ title, children, className }) {
  return (
    <section className={cn("rounded-2xl bg-card p-4 shadow-xs ring-1 ring-border", className)}>
      <h2 className="mb-3"><Label>{title}</Label></h2>
      {children}
    </section>
  );
}

function BreakdownRow({ children, value, delta, shaded }) {
  return (
    <div className={cn("flex items-center justify-between rounded-lg px-2.5 py-2 text-sm", shaded && "bg-muted/60")}>
      <span>{children}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono tabular-nums">{value.toLocaleString("en-IN")}</span>
        <span className="w-12 text-right"><Delta value={delta} /></span>
      </span>
    </div>
  );
}

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
              <WeekChart data={data.shipped_over_time} />
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
                      <BreakdownRow key={l.location} value={l.count} shaded={i % 2 === 1}>{l.location}</BreakdownRow>
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
