import { useState } from "react";
import { Activity } from "lucide-react";

import DataTable from "../components/DataTable.jsx";
import { ChannelBadge } from "../components/ChannelBadge.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import { ListEyebrow } from "../components/list-eyebrow.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import { Select } from "@/components/ui/select.jsx";
import { useGetActivityQuery } from "../api/services/activity.js";
import { formatApiError } from "../lib/errors.js";
import { syncTone } from "../lib/status.js";

const KINDS = [
  { value: "", label: "All events" },
  { value: "reservation", label: "Reservation" },
  { value: "availability_push", label: "Availability push" },
  { value: "order_fetch", label: "Order fetch" },
  { value: "restock", label: "Restock" },
  { value: "mapping", label: "Mapping" },
  { value: "mismatch", label: "Mismatch" },
];

const COLUMNS = [
  { key: "channel", label: "Channel", render: (row) => <ChannelBadge channel={row.channel} /> },
  { key: "kind", label: "Event", render: (row) => row.kind.replace("_", " ") },
  { key: "itemCode", label: "Item code", mono: true },
  { key: "message", label: "Message" },
  { key: "status", label: "Status", render: (row) => <StatusBadge tone={syncTone(row.status)}>{row.status}</StatusBadge> },
  { key: "ts", label: "When", mono: true, render: (row) => new Date(row.ts).toLocaleString() },
];

export default function ActivityLog() {
  const [kind, setKind] = useState("");
  const { data, isFetching, error, refetch } = useGetActivityQuery({ kind: kind || undefined });

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Every inventory push and order fetch, timestamped and channel-tagged — this is the real
        thing, not a demo mock of a log.
      </p>
      <div className="mb-3">
        <Select value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
      </div>
      <ListEyebrow count={data?.count ?? 0} noun="events" />
      <DataTable
        columns={COLUMNS}
        rows={data?.rows ?? []}
        loading={isFetching}
        error={formatApiError(error)}
        onRetry={refetch}
        empty={
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="Every sync push and order fetch will show up here as it happens."
          />
        }
      />
    </div>
  );
}
