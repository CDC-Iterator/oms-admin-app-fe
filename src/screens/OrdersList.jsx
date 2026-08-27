import { useState } from "react";
import { Receipt } from "lucide-react";
import { Link } from "react-router-dom";

import DataTable from "../components/DataTable.jsx";
import { ChannelBadge } from "../components/ChannelBadge.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import { ListEyebrow } from "../components/list-eyebrow.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import { Select } from "@/components/ui/select.jsx";
import { useGetOrdersQuery } from "../api/services/orders.js";
import { formatApiError } from "../lib/errors.js";
import { reservationTone } from "../lib/status.js";

const CHANNELS = [
  { value: "", label: "All channels" },
  { value: "shopify", label: "Shopify" },
];

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "reserved", label: "Reserved" },
  { value: "cancelled", label: "Cancelled" },
  { value: "restocked", label: "Restocked" },
];

const COLUMNS = [
  {
    key: "orderNumber",
    label: "Order",
    mono: true,
    render: (row) => (
      <Link to={`/orders/${row.id}`} className="text-primary hover:underline">
        {row.orderNumber}
      </Link>
    ),
  },
  { key: "channel", label: "Channel", render: (row) => <ChannelBadge channel={row.channel} /> },
  { key: "title", label: "Item" },
  { key: "customerName", label: "Customer" },
  {
    key: "unitPrice",
    label: "Total",
    mono: true,
    render: (row) => `${row.unitPrice?.toLocaleString("en-IN")} ${row.currency || ""}`.trim(),
  },
  {
    key: "reservationStatus",
    label: "Reservation",
    render: (row) => (
      <StatusBadge tone={reservationTone(row.reservationStatus)}>{row.reservationStatus}</StatusBadge>
    ),
  },
  {
    key: "placedAt",
    label: "Placed",
    mono: true,
    render: (row) => (row.placedAt ? new Date(row.placedAt).toLocaleString() : "—"),
  },
];

export default function OrdersList() {
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const { data, isFetching, error, refetch } = useGetOrdersQuery({
    channel: channel || undefined,
    status: status || undefined,
  });

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Every order from every channel lands here the moment it's placed, reserved against POS 2.0
        — no manual sync.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
          {CHANNELS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
      <ListEyebrow count={data?.count ?? 0} noun="orders" />
      <DataTable
        columns={COLUMNS}
        rows={data?.rows ?? []}
        loading={isFetching}
        error={formatApiError(error)}
        onRetry={refetch}
        empty={
          <EmptyState
            icon={Receipt}
            title="No orders yet"
            description="New orders will show up here the moment a customer checks out on any channel."
          />
        }
      />
    </div>
  );
}
