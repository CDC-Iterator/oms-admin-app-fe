import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Receipt } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { ChannelBadge } from "../components/ChannelBadge.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import { FulfilledByBadge } from "../components/FulfilledByBadge.jsx";
import Pagination from "../components/Pagination.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Select } from "@/components/ui/select.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { useGetOrderQuery, useGetOrdersQuery, useGetOrderStatusSummaryQuery } from "../api/services/orders.js";
import { formatApiError } from "../lib/errors.js";
import { fulfillmentTone, paymentTone, SUGGESTION_HIDDEN_STATUSES } from "../lib/status.js";

const PAGE_SIZE = 50;

// Order.channel choices — apps.channels.models.
const CHANNELS = [
  { value: "", label: "All channels" },
  { value: "shopify", label: "Shopify" },
  { value: "tatacliq", label: "TataCliq" },
  { value: "pos", label: "POS" },
];

const COLUMN_COUNT = 9;

function useDebounced(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// Expanded row's content — lazily fetches the order detail (line items
// aren't on the list response, apps.orders.serializers.OrderListSerializer's
// own docstring explains why) only once a row is actually opened.
function LineItemsRow({ orderId }) {
  const { data: order, isFetching, error } = useGetOrderQuery(orderId);
  const lineItems = order?.line_items ?? [];
  const showSuggested = !SUGGESTION_HIDDEN_STATUSES.has(order?.status);

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={COLUMN_COUNT} className="bg-muted/20 py-2">
        {error ? (
          <p className="text-xs text-destructive">{formatApiError(error)}</p>
        ) : isFetching ? (
          <Skeleton className="h-16 w-full" />
        ) : lineItems.length === 0 ? (
          <p className="pl-8 text-xs text-muted-foreground">No line items on this order.</p>
        ) : (
          <div className="overflow-hidden rounded-lg ring-1 ring-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-8 text-[0.65rem]">SKU</TableHead>
                  <TableHead className="h-8 text-center text-[0.65rem]">Qty</TableHead>
                  <TableHead className="h-8 text-center text-[0.65rem]">Price</TableHead>
                  <TableHead className="h-8 text-[0.65rem]">Unit</TableHead>
                  <TableHead className="h-8 text-[0.65rem]">Fulfilled by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((li) => (
                  <TableRow key={li.id}>
                    <TableCell className="font-mono text-xs">{li.external_sku}</TableCell>
                    <TableCell className="text-center font-mono text-xs tabular-nums">{li.qty}</TableCell>
                    <TableCell className="text-center font-mono text-xs tabular-nums">
                      {Number(li.price ?? 0).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {li.is_fully_confirmed
                        ? li.confirmed_units.join(", ")
                        : showSuggested && li.suggested_units?.length > 0
                          ? li.suggested_units.join(", ")
                          : "—"}
                      {!li.is_fully_confirmed && showSuggested && li.suggested_units?.length > 0 && (
                        <StatusBadge tone="pending" className="ml-1.5">
                          Suggested
                        </StatusBadge>
                      )}
                    </TableCell>
                    <TableCell>
                      <FulfilledByBadge lineItem={li} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

export default function OrdersList() {
  const [channel, setChannel] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  // Page and status tab both live in the URL (?page=/?status=), not
  // component state — a refresh (or a shared/bookmarked link) lands back
  // on the same page AND tab instead of resetting either.
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page")) || 1;
  const status = searchParams.get("status") || "";

  const updateParams = (updates) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(updates)) {
          if (value === null || value === undefined || value === "") {
            next.delete(key);
          } else {
            next.set(key, String(value));
          }
        }
        return next;
      },
      { replace: true }
    );
  };
  const setPage = (nextPage) => updateParams({ page: nextPage <= 1 ? null : nextPage });

  // Page resets to 1 from these handlers directly, not a useEffect keyed on
  // [status, channel, debouncedSearch] — that also fires on mount (and
  // React.StrictMode's dev-only double-invoke defeats any ref-based "skip
  // the first run" guard), clobbering ?page=/?status= from a
  // refreshed/shared URL.
  const handleStatusChange = (nextStatus) => updateParams({ status: nextStatus, page: null });
  const handleChannelChange = (value) => {
    setChannel(value);
    setPage(1);
  };
  const handleSearchChange = (value) => {
    setSearch(value);
    setPage(1);
  };

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const searchParam = debouncedSearch || undefined;
  const channelParam = channel || undefined;
  const { data, isFetching, error, refetch } = useGetOrdersQuery({
    page,
    status: status || undefined,
    channel: channelParam,
    search: searchParam,
  });
  const { data: statusSummary } = useGetOrderStatusSummaryQuery({ channel: channelParam, search: searchParam });
  const rows = data?.rows ?? [];
  const totalCount = (statusSummary ?? []).reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="mb-4 shrink-0 text-sm text-muted-foreground">
        Every order from every channel, reconciled against one inventory ledger.
      </p>

      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <Input
          placeholder="Search order, customer, city…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="flex-1"
        />
        <Select value={channel} onChange={(e) => handleChannelChange(e.target.value)}>
          {CHANNELS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="mb-3 flex shrink-0 flex-wrap gap-1 border-b border-border">
        <button
          onClick={() => handleStatusChange("")}
          className={
            "rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
            (status === ""
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground")
          }
        >
          All {statusSummary ? `(${totalCount})` : ""}
        </button>
        {(statusSummary ?? []).map((s) => (
          <button
            key={s.status}
            onClick={() => handleStatusChange(s.status)}
            className={
              "rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
              (status === s.status
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {s.label} ({s.count})
          </button>
        ))}
      </div>

      {error ? (
        <EmptyState
          tone="danger"
          title="Couldn't load orders"
          description={`${formatApiError(error)} — try again.`}
          action={
            <Button size="sm" variant="outline" onClick={refetch}>
              Try again
            </Button>
          }
        />
      ) : isFetching && !data ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No orders found"
          description="New orders will show up here the moment a customer checks out on any channel."
        />
      ) : (
        // See InventoryList.jsx's own comment for why overflow-hidden lands
        // here and min-h-0/flex-1 on the nested [data-slot=table-container].
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl ring-1 ring-border [&>[data-slot=table-container]]:min-h-0 [&>[data-slot=table-container]]:flex-1">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-8 w-8 border-b-2 border-border" />
                <TableHead className="h-8 border-b-2 border-border">Order</TableHead>
                <TableHead className="h-8 border-b-2 border-border">Date</TableHead>
                <TableHead className="h-8 border-b-2 border-border">Channel</TableHead>
                <TableHead className="h-8 border-b-2 border-border">Customer</TableHead>
                <TableHead className="h-8 border-b-2 border-border text-center">Total</TableHead>
                <TableHead className="h-8 border-b-2 border-border">Payment</TableHead>
                <TableHead className="h-8 border-b-2 border-border">Fulfillment</TableHead>
                <TableHead className="h-8 border-b-2 border-border">Destination</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const isExpanded = expandedIds.has(row.id);
                const destination = [row.shipping_city, row.shipping_pincode].filter(Boolean).join(" · ");
                return (
                  <Fragment key={row.id}>
                    <TableRow>
                      <TableCell className="py-1.5">
                        <Button variant="ghost" size="icon-sm" onClick={() => toggleExpanded(row.id)}>
                          {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                          <span className="sr-only">{isExpanded ? "Hide line items" : "Show line items"}</span>
                        </Button>
                      </TableCell>
                      <TableCell className="py-1.5 font-mono text-xs">
                        <Link to={`/orders/${row.id}`} className="text-primary hover:underline" title={row.external_order_id}>
                          {row.order_name || row.external_order_id}
                        </Link>
                      </TableCell>
                      <TableCell className="py-1.5 font-mono text-xs text-muted-foreground">
                        {row.created_at ? new Date(row.created_at).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="py-1.5">
                        <ChannelBadge channel={row.channel} />
                      </TableCell>
                      <TableCell className="py-1.5 text-sm">{row.customer_name || "—"}</TableCell>
                      <TableCell className="py-1.5 text-center font-mono text-xs tabular-nums">
                        {Number(row.total_amount ?? 0).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="py-1.5">
                        {row.payment_status ? (
                          <StatusBadge tone={paymentTone(row.payment_status)}>{row.payment_status}</StatusBadge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="py-1.5">
                        <StatusBadge tone={fulfillmentTone(row.fulfillment_status)}>{row.fulfillment_status}</StatusBadge>
                      </TableCell>
                      <TableCell className="py-1.5 text-sm">{destination || "—"}</TableCell>
                    </TableRow>
                    {isExpanded && <LineItemsRow orderId={row.id} />}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="shrink-0">
        <Pagination page={page} pageSize={PAGE_SIZE} count={data?.count ?? 0} onPageChange={setPage} />
      </div>
    </div>
  );
}
