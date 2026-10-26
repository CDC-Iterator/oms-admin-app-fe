import DataTable from "../components/DataTable.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import { ListEyebrow } from "../components/list-eyebrow.jsx";
import LocationChannelMapper from "../components/LocationChannelMapper.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import { Warehouse } from "lucide-react";
import { useGetLocationsQuery } from "../api/services/locations.js";
import { useAuth } from "../hooks/useAuth.js";
import { formatApiError } from "../lib/errors.js";

const COLUMNS = [
  { key: "code", label: "Code", mono: true },
  { key: "name", label: "Name" },
  {
    key: "type",
    label: "Type",
    render: (row) => (
      <StatusBadge tone={row.type === "warehouse" ? "info" : "neutral"}>
        {row.type}
      </StatusBadge>
    ),
  },
  { key: "city", label: "City" },
  { key: "zone", label: "Zone", render: (row) => row.zone || "—" },
  {
    key: "pick_order",
    label: "Pick order",
    render: (row) =>
      row.pick_order ? (
        <StatusBadge tone="neutral">{row.pick_order}</StatusBadge>
      ) : (
        "—"
      ),
  },
];

// Allocation picks warehouses before stores, and within each in zone-rank order; equal rank shares a number.
function withPickOrder(rows) {
  const tier = (r) => (r.type === "warehouse" ? 0 : 1);
  const rank = (r) => r.zone_rank ?? Number.MAX_SAFE_INTEGER;
  const sorted = [...rows].sort(
    (a, b) =>
      tier(a) - tier(b) || rank(a) - rank(b) || a.name.localeCompare(b.name),
  );
  let order = 0;
  let prev = null;
  return sorted.map((row) => {
    const key = `${tier(row)}:${rank(row)}`;
    if (key !== prev) order += 1;
    prev = key;
    return { ...row, pick_order: row.zone_rank == null ? null : order };
  });
}

// Read-only — Location rows are POS-mirrored/seeded, not created here.
export default function LocationsList() {
  const { data, isFetching, error, refetch } = useGetLocationsQuery();
  const { user } = useAuth();
  // Matches the backend's IsSuperAdmin gate on /api/channels/connections/ —
  // the mapper fetches its own data, just gated on rendering at all here.
  const canSeeChannelMapping = user?.is_superuser || user?.role === "admin";

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        The stores and warehouses as POS 2.0 names them — mirrored, not managed
        here. Pick order is how inventory allocation prefers them: warehouses
        first, then stores, each in zone order (lower zone rank first).
      </p>
      <ListEyebrow count={data?.count ?? 0} noun="locations" live={false} />
      <DataTable
        columns={COLUMNS}
        rows={withPickOrder(data?.rows ?? [])}
        loading={isFetching}
        error={formatApiError(error)}
        onRetry={refetch}
        empty={
          <EmptyState
            icon={Warehouse}
            title="No locations yet"
            description="Locations mirrored from POS 2.0 will appear here."
          />
        }
      />
      {canSeeChannelMapping && <LocationChannelMapper />}
    </div>
  );
}
