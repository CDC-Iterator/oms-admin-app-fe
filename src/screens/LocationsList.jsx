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
    render: (row) => <StatusBadge tone={row.type === "warehouse" ? "info" : "neutral"}>{row.type}</StatusBadge>,
  },
  { key: "city", label: "City" },
];

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
        The stores and warehouses as POS 2.0 names them — mirrored, not managed here.
      </p>
      <ListEyebrow count={data?.count ?? 0} noun="locations" live={false} />
      <DataTable
        columns={COLUMNS}
        rows={data?.rows ?? []}
        loading={isFetching}
        error={formatApiError(error)}
        onRetry={refetch}
        empty={<EmptyState icon={Warehouse} title="No locations yet" description="Locations mirrored from POS 2.0 will appear here." />}
      />
      {canSeeChannelMapping && <LocationChannelMapper />}
    </div>
  );
}
