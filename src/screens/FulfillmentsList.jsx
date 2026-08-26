import { Truck } from "lucide-react";

import DataTable from "../components/DataTable.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import { ListEyebrow } from "../components/list-eyebrow.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import { useGetFulfillmentsQuery } from "../api/services/fulfillments.js";
import { formatApiError } from "../lib/errors.js";
import { fulfillmentRecordTone } from "../lib/status.js";

const COLUMNS = [
  { key: "shopify_fulfillment_id", label: "Fulfillment", mono: true },
  { key: "shopify_order_id", label: "Order", mono: true, render: (row) => row.shopify_order_id || "—" },
  {
    key: "status",
    label: "Status",
    render: (row) =>
      row.status ? (
        <StatusBadge tone={fulfillmentRecordTone(row.status)}>{row.status}</StatusBadge>
      ) : (
        "—"
      ),
  },
  {
    key: "tracking_number",
    label: "Tracking",
    mono: true,
    render: (row) =>
      row.tracking_number ? (
        <span>
          {row.tracking_number}
          {row.tracking_company ? (
            <span className="ml-1.5 font-sans text-xs text-muted-foreground">
              ({row.tracking_company})
            </span>
          ) : null}
        </span>
      ) : (
        "—"
      ),
  },
  {
    key: "shopify_created_at",
    label: "Shipped",
    mono: true,
    render: (row) =>
      row.shopify_created_at ? new Date(row.shopify_created_at).toLocaleString() : "—",
  },
];

export default function FulfillmentsList() {
  const { data, isFetching, error, refetch } = useGetFulfillmentsQuery();

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Shipped and packed orders land here as fulfillments post from Shopify.
      </p>
      <ListEyebrow count={data?.count ?? 0} noun="fulfillments" />
      <DataTable
        columns={COLUMNS}
        rows={data?.rows ?? []}
        loading={isFetching}
        error={formatApiError(error)}
        onRetry={refetch}
        empty={
          <EmptyState
            icon={Truck}
            title="No fulfillments yet"
            description="Shipped and packed orders will show up here."
          />
        }
      />
    </div>
  );
}
