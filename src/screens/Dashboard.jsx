import { AlertTriangle, Receipt } from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { ChannelBadge } from "@/components/ChannelBadge.jsx";
import { StatusBadge } from "@/components/status-badge.jsx";
import {
  useGetChannelSalesReportQuery,
  useGetOrderStatusSummaryReportQuery,
  useGetUnmappedSkusReportQuery,
} from "../api/services/reports.js";
import { reservationTone } from "../lib/status.js";

function MetricCard({ icon: Icon, label, value, isLoading, tone }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <Icon className="size-3.5" strokeWidth={2} />
          {label}
        </CardDescription>
        <CardTitle
          className={
            "font-heading text-3xl font-semibold tabular-nums " + (tone === "danger" ? "text-destructive" : "text-foreground")
          }
        >
          {isLoading ? <Skeleton className="h-8 w-14" /> : value}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

// Composed entirely from real report endpoints (apps.reports) — no
// dashboard/stats aggregation endpoint exists on the backend.
export default function Dashboard() {
  const { data: statusRows, isFetching: statusLoading } = useGetOrderStatusSummaryReportQuery();
  const { data: unmapped, isFetching: unmappedLoading } = useGetUnmappedSkusReportQuery();
  const { data: channelSales, isFetching: salesLoading } = useGetChannelSalesReportQuery();

  const totalOrders = (statusRows ?? []).reduce((sum, r) => sum + r.order_count, 0);
  const pendingCount = (statusRows ?? []).find((r) => r.status === "pending")?.order_count ?? 0;

  return (
    <div>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        One inventory ledger, kept honest across every channel and location.
      </p>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard icon={Receipt} label="Total orders" value={totalOrders} isLoading={statusLoading} />
        <MetricCard icon={Receipt} label="Pending" value={pendingCount} isLoading={statusLoading} tone={pendingCount ? "danger" : undefined} />
        <MetricCard
          icon={AlertTriangle}
          label="Unmapped SKUs"
          value={unmapped?.count ?? 0}
          isLoading={unmappedLoading}
          tone={unmapped?.count ? "danger" : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Channel-wise sales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {salesLoading && <Skeleton className="h-16 w-full" />}
            {(channelSales ?? []).map((c) => (
              <div key={c.channel} className="flex items-center justify-between text-sm">
                <ChannelBadge channel={c.channel} />
                <span className="font-mono tabular-nums text-muted-foreground">
                  {c.order_count} orders · ₹{Number(c.total_sales).toLocaleString("en-IN")}
                </span>
              </div>
            ))}
            {!salesLoading && (channelSales ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No sales yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Orders by status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {statusLoading && <Skeleton className="h-16 w-full" />}
            {(statusRows ?? []).map((r) => (
              <div key={r.status} className="flex items-center justify-between text-sm">
                <StatusBadge tone={reservationTone(r.status)}>{r.status}</StatusBadge>
                <span className="font-mono tabular-nums text-muted-foreground">{r.order_count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {unmapped?.count > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          <Link to="/catalog/unmapped" className="text-primary hover:underline">
            {unmapped.count} SKU{unmapped.count === 1 ? "" : "s"} waiting on a mapping →
          </Link>
        </p>
      )}
    </div>
  );
}
