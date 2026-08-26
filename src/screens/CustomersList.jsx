import { Users } from "lucide-react";

import DataTable from "../components/DataTable.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import { ListEyebrow } from "../components/list-eyebrow.jsx";
import { useGetCustomersQuery } from "../api/services/customers.js";
import { formatApiError } from "../lib/errors.js";

const COLUMNS = [
  {
    key: "name",
    label: "Name",
    render: (row) => [row.first_name, row.last_name].filter(Boolean).join(" ") || "—",
  },
  { key: "email", label: "Email", mono: true },
  { key: "orders_count", label: "Orders", mono: true, render: (row) => row.orders_count ?? "—" },
  { key: "total_spent", label: "Total spent", mono: true, render: (row) => row.total_spent ?? "—" },
  {
    key: "shopify_created_at",
    label: "Joined",
    mono: true,
    render: (row) =>
      row.shopify_created_at ? new Date(row.shopify_created_at).toLocaleString() : "—",
  },
];

export default function CustomersList() {
  const { data, isFetching, error, refetch } = useGetCustomersQuery();

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Customer profiles appear here as Shopify sends order and account activity.
      </p>
      <ListEyebrow count={data?.count ?? 0} noun="customers" />
      <DataTable
        columns={COLUMNS}
        rows={data?.rows ?? []}
        loading={isFetching}
        error={formatApiError(error)}
        onRetry={refetch}
        empty={
          <EmptyState
            icon={Users}
            title="No customers yet"
            description="New customer profiles will appear here as orders come in."
          />
        }
      />
    </div>
  );
}
