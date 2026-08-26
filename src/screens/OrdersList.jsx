import { Receipt } from "lucide-react";

import DataTable from "../components/DataTable.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import { ListEyebrow } from "../components/list-eyebrow.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import { useGetOrdersQuery } from "../api/services/orders.js";
import { formatApiError } from "../lib/errors.js";
import { paymentTone } from "../lib/status.js";

const COLUMNS = [
  { key: "order_number", label: "Order", mono: true },
  { key: "customer_name", label: "Customer" },
  {
    key: "total_price",
    label: "Total",
    mono: true,
    render: (row) => (row.total_price ? `${row.total_price} ${row.currency || ""}`.trim() : "—"),
  },
  {
    key: "financial_status",
    label: "Payment",
    render: (row) =>
      row.financial_status ? (
        <StatusBadge tone={paymentTone(row.financial_status)}>{row.financial_status}</StatusBadge>
      ) : (
        "—"
      ),
  },
  {
    key: "fulfillment_status",
    label: "Fulfillment",
    render: (row) => row.fulfillment_status || <span className="text-muted-foreground">Unfulfilled</span>,
  },
  {
    key: "shopify_created_at",
    label: "Placed",
    mono: true,
    render: (row) =>
      row.shopify_created_at ? new Date(row.shopify_created_at).toLocaleString() : "—",
  },
];

export default function OrdersList() {
  const { data, isFetching, error, refetch } = useGetOrdersQuery();

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Every order lands here the moment Shopify sends it — no manual sync.
      </p>
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
            description="New orders will show up here the moment a customer checks out."
          />
        }
      />
    </div>
  );
}
