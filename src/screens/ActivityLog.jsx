import { useState } from "react";
import { Activity } from "lucide-react";

import DataTable from "../components/DataTable.jsx";
import { ChannelBadge } from "../components/ChannelBadge.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import { ListEyebrow } from "../components/list-eyebrow.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import { Select } from "@/components/ui/select.jsx";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet.jsx";
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
  { key: "summary", label: "Details", render: (row) => row.summary || "—" },
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
  const [selected, setSelected] = useState(null);
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
        onRowClick={setSelected}
        empty={
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="Every sync push and fetch will show up here as it happens."
          />
        }
      />
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono text-sm">{selected.topic}</SheetTitle>
                <SheetDescription>{new Date(selected.timestamp).toLocaleString()}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-4">
                <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Channel</dt>
                  <dd>
                    <ChannelBadge channel={selected.channel} />
                  </dd>
                  <dt className="text-muted-foreground">Direction</dt>
                  <dd>{selected.direction}</dd>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <StatusBadge tone={syncTone(selected.status)}>{selected.status}</StatusBadge>
                  </dd>
                  {selected.summary && (
                    <>
                      <dt className="text-muted-foreground">Details</dt>
                      <dd>{selected.summary}</dd>
                    </>
                  )}
                </dl>
                {selected.error && (
                  <div>
                    <h3 className="mb-1 text-xs font-medium uppercase text-muted-foreground">Error</h3>
                    <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-destructive/10 p-3 font-mono text-xs">
                      {selected.error}
                    </pre>
                  </div>
                )}
                <div>
                  <h3 className="mb-1 text-xs font-medium uppercase text-muted-foreground">Payload</h3>
                  <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
                    {Object.keys(selected.payload ?? {}).length ? JSON.stringify(selected.payload, null, 2) : "No payload recorded"}
                  </pre>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
