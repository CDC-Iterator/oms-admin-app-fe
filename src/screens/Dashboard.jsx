import { AlertTriangle, Radio, ShieldCheck, Waypoints } from "lucide-react";

import { Badge } from "@/components/ui/badge.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { DemoSimulator } from "@/components/DemoSimulator.jsx";
import { StatusBadge } from "@/components/status-badge.jsx";
import { useGetStatsQuery } from "../api/services/stats.js";
import { syncTone } from "../lib/status.js";

function MetricCard({ icon: Icon, label, value, isLoading, tone, hint }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <Icon className="size-3.5" strokeWidth={2} />
          {label}
        </CardDescription>
        <CardTitle
          className={
            "font-heading text-3xl font-semibold tabular-nums " +
            (tone === "danger"
              ? "text-destructive"
              : tone === "success"
                ? "text-[color-mix(in_srgb,var(--status-success)_70%,black)]"
                : "text-foreground")
          }
        >
          {isLoading ? <Skeleton className="h-8 w-14" /> : value}
        </CardTitle>
      </CardHeader>
      {hint && (
        <CardContent className="pt-0">
          <span className="text-xs text-muted-foreground">{hint}</span>
        </CardContent>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const { data, isFetching } = useGetStatsQuery();

  const lastSyncLabel = data?.lastSyncAt
    ? `${Math.max(0, Math.round((Date.now() - new Date(data.lastSyncAt).getTime()) / 60000))}m ago`
    : "—";

  return (
    <div>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        One inventory pool, kept honest across Shopify and every retail location — the
        number below is the whole promise.
      </p>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={ShieldCheck}
          label="Oversell exposure"
          value={data?.oversellExposure ?? 0}
          isLoading={isFetching && data === undefined}
          tone="success"
          hint="Units sold on more than one channel at once"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Unmapped in queue"
          value={data?.unmapped ?? 0}
          isLoading={isFetching && data === undefined}
          tone={data?.unmapped ? "danger" : undefined}
          hint="Orders waiting on a SKU mapping"
        />
        <MetricCard
          icon={Radio}
          label="Channels in sync"
          value={`${data?.channelsInSync ?? 0}/${data?.channelCount ?? 0}`}
          isLoading={isFetching && data === undefined}
          hint="Shopify"
        />
        <MetricCard
          icon={Waypoints}
          label="Sync health"
          value={lastSyncLabel}
          isLoading={isFetching && data === undefined}
          tone={data?.syncFailures ? "danger" : undefined}
          hint={
            data?.syncFailures
              ? `${data.syncFailures} failure${data.syncFailures === 1 ? "" : "s"} to review`
              : "No failures outstanding"
          }
        />
      </div>

      <div className="mb-4">
        <DemoSimulator />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Channel-wise sales</CardTitle>
            <CardDescription>Units reserved per channel, this session.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.channelSales ?? []).map((c) => (
              <div key={c.channel} className="flex items-center justify-between text-sm">
                <span>{c.name}</span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {c.orders} orders · ₹{c.revenue.toLocaleString("en-IN")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent sync activity</CardTitle>
            <CardDescription>Live — every push and fetch, channel-tagged.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {(data?.recentActivity ?? []).map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{a.message}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {a.itemCode} · {new Date(a.ts).toLocaleTimeString()}
                  </p>
                </div>
                <StatusBadge tone={syncTone(a.status)} className="shrink-0">
                  {a.status}
                </StatusBadge>
              </div>
            ))}
            {(data?.recentActivity ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <Badge variant="outline" className="font-mono">
          {data?.liveSkus ?? 0} live SKUs · {data?.availableUnits ?? 0} units available
        </Badge>
      </div>
    </div>
  );
}
