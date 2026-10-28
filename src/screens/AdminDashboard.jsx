import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

import { ChannelBadge } from "@/components/ChannelBadge.jsx";
import { BreakdownRow, Delta, MetricCard, Panel, WeekChart } from "@/components/dashboard.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { cn } from "@/lib/utils";
import { useGetAdminDashboardQuery } from "../api/services/reports.js";
import { formatApiError } from "../lib/errors.js";

const rupees = (value) => `₹${Number(value).toLocaleString("en-IN")}`;
// Axis labels in lakh / crore: ₹1.9Cr, ₹97L, ₹40k.
const compactRupees = (v) =>
  v >= 1e7 ? `₹${+(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `₹${+(v / 1e5).toFixed(1)}L` : v >= 1e3 ? `₹${Math.round(v / 1e3)}k` : `₹${v}`;
const HEALTH_DOT = { ok: "bg-emerald-500", stale: "bg-amber-500", failing: "bg-destructive" };
const HEALTH_TEXT = { ok: "Healthy", stale: "No recent success", failing: "Failing" };

function ago(value) {
  if (!value) return "never";
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

export default function AdminDashboard() {
  const { data, isFetching, isLoading, error, refetch } = useGetAdminDashboardQuery(undefined, { pollingInterval: 60000 });

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        Couldn't load the dashboard — {formatApiError(error)}. <Button size="sm" variant="outline" onClick={refetch}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Every channel and location{data ? ` · refreshed ${new Date(data.as_of).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : ""}
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
            <Panel title="Sales over time" className="lg:col-span-2">
              <div className="mb-1 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-semibold tabular-nums">{rupees(data.sales_over_time.total)}</span>
                <Delta value={data.sales_over_time.delta} />
                <span className="text-xs text-muted-foreground">this week vs last week</span>
              </div>
              <WeekChart data={data.sales_over_time} format={compactRupees} className="-mx-4 w-auto" />
              <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-primary" /> This week</span>
                <span className="flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-primary/50" /> Last week</span>
              </div>
            </Panel>

            <Panel title="Sales by channel, this week">
              {data.sales_over_time.by_channel.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sales this week.</p>
              ) : (
                <div className="space-y-0.5">
                  {data.sales_over_time.by_channel.map((c, i) => (
                    <div key={c.channel} className={cn("flex items-center justify-between rounded-lg px-2.5 py-2 text-sm", i % 2 === 1 && "bg-muted/60")}>
                      <span className="flex items-center gap-2"><ChannelBadge channel={c.channel} /><span className="text-xs text-muted-foreground">{c.orders} orders</span></span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono tabular-nums">{rupees(c.sales)}</span>
                        <span className="w-12 text-right"><Delta value={c.delta} /></span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Courier performance, last 30 days" className="lg:col-span-2">
              {data.couriers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No shipments in the last 30 days.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full bg-card text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="px-2.5 py-1.5 font-medium">Courier</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">Shipments</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">Delivered</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">In transit</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">RTO</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">RTO rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.couriers.map((c, i) => (
                        <tr key={c.courier} className={i % 2 === 0 ? "bg-muted/60" : ""}>
                          <td className="rounded-l-lg px-2.5 py-2">{c.label}</td>
                          <td className="px-2.5 py-2 text-right font-mono tabular-nums">{c.total}</td>
                          <td className="px-2.5 py-2 text-right font-mono tabular-nums">{c.delivered}</td>
                          <td className="px-2.5 py-2 text-right font-mono tabular-nums">{c.in_transit}</td>
                          <td className="px-2.5 py-2 text-right font-mono tabular-nums">{c.rto}</td>
                          <td className={cn("rounded-r-lg px-2.5 py-2 text-right font-mono tabular-nums", c.rto_rate >= 10 && "text-destructive")}>{c.rto_rate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="Needs attention">
              <div className="space-y-0.5">
                {data.data_quality.map((a, i) => (
                  <Link key={a.key} to={a.link} className={cn("flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm hover:bg-muted", i % 2 === 1 && "bg-muted/60")}>
                    <span className="flex items-center gap-2">
                      {a.value > 0 ? <AlertTriangle className="size-3.5 shrink-0 text-amber-500" /> : <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />}
                      {a.label}
                    </span>
                    <span className={cn("font-mono tabular-nums", a.value > 0 && "font-semibold")}>{a.value.toLocaleString("en-IN")}</span>
                  </Link>
                ))}
              </div>
            </Panel>
          </div>

          <Panel title="Integration health">
            <div className="grid gap-x-6 gap-y-0.5 md:grid-cols-2">
              {data.integration_health.map((h, i) => (
                <Link key={h.topic} to={h.link} className={cn("flex items-center justify-between rounded-lg px-2.5 py-2 text-sm hover:bg-muted", Math.floor(i / 2) % 2 === 1 ? "md:bg-muted/60" : "", i % 2 === 1 ? "max-md:bg-muted/60" : "")}>
                  <span className="flex items-center gap-2">
                    <span className={cn("size-2 rounded-full", HEALTH_DOT[h.status])} />
                    {h.label}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    {h.failed_24h > 0 && <span className="font-medium text-destructive">{h.failed_24h} failed (24h)</span>}
                    <span title={HEALTH_TEXT[h.status]}>last success {ago(h.last_success)}</span>
                  </span>
                </Link>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Green: syncing normally · amber: no success within its usual window · red: failing. <Link to="/settings/activity" className="text-primary hover:underline">Open the Activity Log →</Link>
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}
