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

// SyncLog.Direction/Status choices — apps.inventory.models.
const DIRECTIONS = [
  { value: "", label: "All directions" },
  { value: "push", label: "Push" },
  { value: "pull", label: "Pull" },
];

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "success", label: "Success" },
  { value: "retrying", label: "Retrying" },
  { value: "failed", label: "Failed" },
];

const COLUMNS = [
  { key: "channel", label: "Channel", render: (row) => (row.channel ? <ChannelBadge channel={row.channel} /> : "—") },
  { key: "direction", label: "Direction" },
  { key: "topic", label: "Topic", mono: true },
  { key: "status", label: "Status", render: (row) => <StatusBadge tone={syncTone(row.status)}>{row.status}</StatusBadge> },
  { key: "error", label: "Error", render: (row) => row.error || "—" },
  {
    key: "timestamp",
    label: "When",
    mono: true,
    render: (row) => new Date(row.timestamp).toLocaleString(),
  },
];

export default function ActivityLog() {
  const [direction, setDirection] = useState("");
  const [status, setStatus] = useState("");
  const { data, isFetching, error, refetch } = useGetActivityQuery({
    direction: direction || undefined,
    status: status || undefined,
  });

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Every POS/channel sync attempt — inbound reads and outbound pushes, with outcome.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select value={direction} onChange={(e) => setDirection(e.target.value)}>
          {DIRECTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
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
            description="Every sync push and fetch will show up here as it happens."
          />
        }
      />
    </div>
  );
}
