import { Boxes } from "lucide-react";

import DataTable from "../components/DataTable.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import { ListEyebrow } from "../components/list-eyebrow.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import { useGetInventoryItemsQuery } from "../api/services/inventory.js";
import { formatApiError } from "../lib/errors.js";
import { stockLevel } from "../lib/status.js";

const COLUMNS = [
  { key: "sku", label: "SKU / item", mono: true, render: (row) => row.sku || row.shopify_inventory_item_id },
  { key: "location_name", label: "Location", render: (row) => row.location_name || "—" },
  { key: "available", label: "Available", mono: true, render: (row) => row.available ?? "—" },
  {
    key: "level",
    label: "Level",
    render: (row) => {
      const level = stockLevel(row.available);
      return <StatusBadge tone={level.tone}>{level.label}</StatusBadge>;
    },
  },
  {
    key: "updated_at",
    label: "Updated",
    mono: true,
    render: (row) => (row.updated_at ? new Date(row.updated_at).toLocaleString() : "—"),
  },
];

export default function InventoryList() {
  const { data, isFetching, error, refetch } = useGetInventoryItemsQuery();

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Stock levels update here as items move in Shopify — count and location, no manual recount.
      </p>
      <ListEyebrow count={data?.count ?? 0} noun="items" />
      <DataTable
        columns={COLUMNS}
        rows={data?.rows ?? []}
        loading={isFetching}
        error={formatApiError(error)}
        onRetry={refetch}
        empty={
          <EmptyState
            icon={Boxes}
            title="No inventory changes yet"
            description="Stock updates will appear here as items move in Shopify."
          />
        }
      />
    </div>
  );
}
