import { useState } from "react";

import { ChannelBadge } from "../components/ChannelBadge.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import {
  useGetChannelSalesReportQuery,
  useGetOrderStatusSummaryReportQuery,
  useGetSyncMismatchesReportQuery,
  useGetUnmappedSkusReportQuery,
} from "../api/services/reports.js";
import { formatApiError } from "../lib/errors.js";
import { reservationTone, syncTone } from "../lib/status.js";

function ChannelSalesTable({ rows }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Channel</TableHead>
          <TableHead>Orders</TableHead>
          <TableHead>Sales</TableHead>
          <TableHead>Discount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.channel}>
            <TableCell>
              <ChannelBadge channel={r.channel} />
            </TableCell>
            <TableCell className="font-mono tabular-nums">{r.order_count}</TableCell>
            <TableCell className="font-mono tabular-nums">₹{Number(r.total_sales).toLocaleString("en-IN")}</TableCell>
            <TableCell className="font-mono tabular-nums">₹{Number(r.total_discount).toLocaleString("en-IN")}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function OrderStatusTable({ rows }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Status</TableHead>
          <TableHead>Count</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.status}>
            <TableCell>
              <StatusBadge tone={reservationTone(r.status)}>{r.status}</StatusBadge>
            </TableCell>
            <TableCell className="font-mono tabular-nums">{r.order_count}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function UnmappedTable({ rows }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Channel</TableHead>
          <TableHead>External SKU</TableHead>
          <TableHead>External variant ID</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <ChannelBadge channel={r.channel} />
            </TableCell>
            <TableCell className="font-mono">{r.external_sku}</TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">{r.external_variant_id}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function MismatchTable({ rows }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Channel</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Error</TableHead>
          <TableHead>When</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>{r.channel ? <ChannelBadge channel={r.channel} /> : "—"}</TableCell>
            <TableCell>
              <StatusBadge tone={syncTone(r.status)}>{r.status}</StatusBadge>
            </TableCell>
            <TableCell className="max-w-xs truncate">{r.error || "—"}</TableCell>
            <TableCell className="font-mono">{new Date(r.timestamp).toLocaleString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const TABS = [
  { key: "channelSales", label: "Channel-wise sales" },
  { key: "orderStatus", label: "Order status" },
  { key: "unmapped", label: "Unmapped SKUs" },
  { key: "mismatch", label: "Sync mismatch log" },
];

// One fixed hook call per report — a variable `useQuery()` call would break
// React's rules of hooks the moment the selected tab changes.
function ReportResult({ isPaginated, data, isFetching, error, refetch, Body }) {
  const rows = isPaginated ? (data?.rows ?? []) : (data ?? []);

  if (error) {
    return (
      <EmptyState
        tone="danger"
        title="Couldn't load this report"
        description={`${formatApiError(error)} — try again.`}
        action={
          <Button size="sm" variant="outline" onClick={refetch}>
            Try again
          </Button>
        }
      />
    );
  }
  if (isFetching && !data) return <Skeleton className="h-48 w-full" />;
  if (rows.length === 0) return <EmptyState title="Nothing here yet" description="This report is empty right now." />;

  return (
    <div className="rounded-xl ring-1 ring-border">
      <Body rows={rows} />
    </div>
  );
}

function ChannelSalesTab() {
  return <ReportResult {...useGetChannelSalesReportQuery()} Body={ChannelSalesTable} />;
}
function OrderStatusTab() {
  return <ReportResult {...useGetOrderStatusSummaryReportQuery()} Body={OrderStatusTable} />;
}
function UnmappedTab() {
  return <ReportResult {...useGetUnmappedSkusReportQuery()} Body={UnmappedTable} isPaginated />;
}
function MismatchTab() {
  return <ReportResult {...useGetSyncMismatchesReportQuery()} Body={MismatchTable} isPaginated />;
}

const TAB_PANELS = {
  channelSales: ChannelSalesTab,
  orderStatus: OrderStatusTab,
  unmapped: UnmappedTab,
  mismatch: MismatchTab,
};

export default function Reports() {
  const [tabKey, setTabKey] = useState(TABS[0].key);
  const Panel = TAB_PANELS[tabKey];

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Channel sales, order status, what's blocked on a mapping, and where a channel's count
        drifted from the ledger.
      </p>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-border pb-px">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTabKey(t.key)}
            className={
              "rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
              (tabKey === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <Panel />
    </div>
  );
}
