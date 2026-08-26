import { ArrowUpRight, Boxes, Receipt, Truck, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetStatsQuery } from "../api/services/stats.js";

const SECTIONS = [
  { key: "orders", to: "/orders", label: "Orders", icon: Receipt, hint: "Order webhooks" },
  { key: "inventory", to: "/inventory", label: "Inventory", icon: Boxes, hint: "Inventory webhooks" },
  {
    key: "fulfillments",
    to: "/fulfillments",
    label: "Fulfillments",
    icon: Truck,
    hint: "Fulfillment webhooks",
  },
  { key: "customers", to: "/customers", label: "Customers", icon: Users, hint: "Customer webhooks" },
];

function StatCard({ section, count, isFetching }) {
  const Icon = section.icon;

  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <Icon className="size-3.5" strokeWidth={2} />
          {section.label}
        </CardDescription>
        <CardTitle className="font-heading text-3xl font-semibold tabular-nums">
          {isFetching && count === undefined ? <Skeleton className="h-8 w-14" /> : (count ?? 0)}
        </CardTitle>
      </CardHeader>
      <CardFooter className="justify-between border-t-0 bg-transparent pt-0">
        <span className="text-xs text-muted-foreground">{section.hint}</span>
        <Link
          to={section.to}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View all
          <ArrowUpRight className="size-3.5" />
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function Dashboard() {
  // One aggregated request instead of a separate list fetch per section —
  // see backend/shopify/merchant_api/views.py StatsView.
  const { data, isFetching } = useGetStatsQuery();

  return (
    <div>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        A live snapshot of everything Shopify has pushed to CDC OMS so far — orders, inventory,
        fulfillments, and customers, each counted straight from the database.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SECTIONS.map((section) => (
          <StatCard
            key={section.to}
            section={section}
            count={data?.[section.key]}
            isFetching={isFetching}
          />
        ))}
      </div>
    </div>
  );
}
