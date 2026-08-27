import { useState } from "react";

import { ChannelBadge } from "../components/ChannelBadge.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { useGetReportsQuery } from "../api/services/reports.js";
import { formatApiError } from "../lib/errors.js";
import { reservationTone, syncTone } from "../lib/status.js";

const TABS = [
  { key: "channelSales", label: "Channel-wise sales" },
  { key: "orderStatus", label: "Order status" },
  { key: "unmapped", label: "Unmapped SKUs" },
  { key: "mismatch", label: "Sync mismatch log" },
];

function ChannelSalesTable({ rows }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Channel</TableHead>
          <TableHead>Orders</TableHead>
          <TableHead>Revenue</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>{r.name}</TableCell>
            <TableCell className="font-mono tabular-nums">{r.orders}</TableCell>
            <TableCell className="font-mono tabular-nums">₹{r.revenue.toLocaleString("en-IN")}</TableCell>
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
          <TableRow key={r.id}>
            <TableCell>
              <StatusBadge tone={reservationTone(r.status)}>{r.status}</StatusBadge>
            </TableCell>
            <TableCell className="font-mono tabular-nums">{r.count}</TableCell>
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
          <TableHead>Channel SKU</TableHead>
          <TableHead>Item</TableHead>
          <TableHead>Placed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <ChannelBadge channel={r.channel} />
            </TableCell>
            <TableCell className="font-mono">{r.channelSku}</TableCell>
            <TableCell>{r.title}</TableCell>
            <TableCell className="font-mono">{new Date(r.placedAt).toLocaleString()}</TableCell>
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
          <TableHead>Item code</TableHead>
          <TableHead>Message</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>When</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <ChannelBadge channel={r.channel} />
            </TableCell>
            <TableCell className="font-mono">{r.itemCode}</TableCell>
            <TableCell>{r.message}</TableCell>
            <TableCell>
              <StatusBadge tone={syncTone(r.status)}>{r.status}</StatusBadge>
            </TableCell>
            <TableCell className="font-mono">{new Date(r.ts).toLocaleString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const TABLES = {
  channelSales: ChannelSalesTable,
  orderStatus: OrderStatusTable,
  unmapped: UnmappedTable,
  mismatch: MismatchTable,
};

export default function Reports() {
  const [tab, setTab] = useState(TABS[0].key);
  const { data, isFetching, error, refetch } = useGetReportsQuery();

  const rows = data?.[tab] ?? [];
  const Body = TABLES[tab];

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        What you'd actually open on a Monday morning — channel sales, order status, what's blocked
        on a mapping, and where a channel's count has drifted from the pool.
      </p>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-border pb-px">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
              (tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <EmptyState
          tone="danger"
          title="Couldn't load reports"
          description={`${formatApiError(error)} — try again.`}
          action={
            <Button size="sm" variant="outline" onClick={refetch}>
              Try again
            </Button>
          }
        />
      ) : isFetching && !data ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing here yet" description="This report is empty right now." />
      ) : (
        // Not overflow-hidden — would trap TableHeader's sticky positioning
        // inside this div instead of the page's real scroll region.
        <div className="rounded-xl ring-1 ring-border">
          <Body rows={rows} />
        </div>
      )}
    </div>
  );
}
