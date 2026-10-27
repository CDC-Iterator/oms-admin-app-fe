import { Fragment, useEffect, useState } from "react";
import { flexRender } from "@tanstack/react-table";
import { ChevronDown, ChevronRight, Loader2, Receipt } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

import { ChannelBadge } from "../components/ChannelBadge.jsx";
import { TableEmptyRow } from "../components/TableEmptyRow.jsx";
import { ColumnHeader } from "../components/ColumnHeader.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import { FulfilledByBadge } from "../components/FulfilledByBadge.jsx";
import { LineProduct } from "../components/LineProduct.jsx";
import Pagination from "../components/Pagination.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { useGetOrderQuery, useGetOrdersQuery } from "../api/services/orders.js";
import ViewFilterChips, { VIEW_ONLY_FILTERS } from "../components/ViewFilterChips.jsx";
import { useServerColumns } from "../hooks/useServerColumns.js";
import SavedViews from "../components/SavedViews.jsx";
import { useSavedViewParams } from "../hooks/useSavedViewParams.js";
import { useMinimumLoading } from "../hooks/useMinimumLoading.js";
import { formatApiError } from "../lib/errors.js";
import { formatPlacedDate } from "../lib/utils.js";
import { fulfillmentTone, orderTone, paymentTone, SUGGESTION_HIDDEN_STATUSES } from "../lib/status.js";

const PAGE_SIZE = 50;
const VIEW_FILTERS = ["dropship", "pos_eligible", "unit_status", "created", "waiting_hours", "profile"];

// Order.channel choices — apps.channels.models.
const CHANNELS = [
  { value: "shopify", label: "Shopify" },
  { value: "tatacliq", label: "TataCliq" },
  { value: "pos", label: "POS" },
];

// Order.Status choices — apps.orders.models.
const ORDER_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "returned", label: "Returned" },
  { value: "rto", label: "RTO" },
  { value: "completed", label: "Completed" },
];

const PAYMENT_STATUSES = ["paid", "partially_paid", "pending", "refunded", "partially_refunded", "voided"].map((v) => ({
  value: v,
  label: v.replace("_", " "),
}));
const FULFILLMENT_STATUSES = ["unfulfilled", "partial", "fulfilled", "restocked"].map((v) => ({ value: v, label: v }));

// TanStack column ids are the backend's ?ordering= keys / filter params (apps.orders.views).
const COLUMNS = [
  { id: "expand", header: "", size: 2.5, enableSorting: false },
  { id: "order", header: "Order", size: 8, meta: { filterIds: true, filterParam: "order_ids" } },
  { id: "invoice", header: "Invoice", size: 8.5, enableSorting: false },
  { id: "placed_at", header: "Date", size: 10.5, meta: { filterDateRange: true, filterParam: "placed" } },
  { id: "channel", header: "Channel", size: 6.5, meta: { filterOptions: CHANNELS, filterParam: "channel", filterMulti: true } },
  { id: "customer", header: "Customer", size: 10, enableSorting: false },
  { id: "items", header: "Items", size: 8, enableSorting: false },
  { id: "total", header: "Total", size: 6, align: "right" },
  { id: "status", header: "Status", size: 8, enableSorting: false, meta: { filterOptions: ORDER_STATUSES, filterParam: "status", filterMulti: true } },
  { id: "payment", header: "Payment", size: 10, enableSorting: false, meta: { filterOptions: PAYMENT_STATUSES, filterParam: "payment_status", filterMulti: true } },
  { id: "fulfillment", header: "Fulfillment", size: 11, enableSorting: false, meta: { filterOptions: FULFILLMENT_STATUSES, filterParam: "fulfillment_status", filterMulti: true } },
  { id: "delivery", header: "Delivery", size: 8.5, enableSorting: false },
  { id: "destination", header: "Destination", size: 10.5, enableSorting: false },
];
const COLUMN_COUNT = COLUMNS.length;
const DEFAULT_ORDERING = "-placed_at";

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
        {/* w-0 min-w-full: fill the row without feeding the content-sized outer table's column widths. */}
        <div className="w-0 min-w-full">
        {error ? (
          <p className="text-xs text-destructive">{formatApiError(error)}</p>
        ) : isFetching ? (
          <Skeleton className="h-16 w-full" />
        ) : lineItems.length === 0 ? (
          <p className="pl-8 text-xs text-muted-foreground">No line items on this order.</p>
        ) : (
          <div className="overflow-hidden rounded-lg ring-1 ring-border">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-8 w-[42%] text-[0.65rem]">Product</TableHead>
                  <TableHead className="h-8 w-[8%] text-center text-[0.65rem]">Qty</TableHead>
                  <TableHead className="h-8 w-[12%] text-right text-[0.65rem]">Price</TableHead>
                  <TableHead className="h-8 w-[22%] text-[0.65rem]">Unit</TableHead>
                  <TableHead className="h-8 w-[16%] text-[0.65rem]">Fulfilled by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((li) => {
                  // An edit that took the line off the order leaves it at qty 0 — shown, but tagged.
                  const removed = li.qty === 0;
                  return (
                  <TableRow key={li.id} className={removed ? "bg-muted/30" : undefined}>
                    <TableCell>
                      <div className={removed ? "line-through opacity-60" : undefined}>
                        <LineProduct line={li} layout="card" />
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs tabular-nums">
                      {removed ? <StatusBadge tone="danger" className="status-chip--compact">Removed</StatusBadge> : li.qty}
                    </TableCell>
                    <TableCell className={"text-right font-mono text-xs tabular-nums" + (removed ? " text-muted-foreground line-through" : "")}>
                      {Number(li.price ?? 0).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {removed
                        ? "—"
                        : li.is_fully_confirmed
                          ? li.confirmed_units.join(", ")
                          : showSuggested && li.suggested_units?.length > 0
                            ? li.suggested_units.join(", ")
                            : "—"}
                      {!removed && !li.is_fully_confirmed && showSuggested && li.suggested_units?.length > 0 && (
                        <StatusBadge tone="pending" className="ml-1.5">
                          Suggested
                        </StatusBadge>
                      )}
                    </TableCell>
                    <TableCell>{removed ? "—" : <FulfilledByBadge lineItem={li} />}</TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function OrdersList() {
  const location = useLocation();
  // Coming back from an order restores the search text too (the filters themselves live in the URL).
  const [search, setSearch] = useState(location.state?.search ?? new URLSearchParams(location.search).get("search") ?? "");
  const debouncedSearch = useDebounced(search, 300);
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  // Page and status tab both live in the URL (?page=/?status=), not
  // component state — a refresh (or a shared/bookmarked link) lands back
  // on the same page AND tab instead of resetting either.
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page")) || 1;

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

  const { table, orderingParam, filterParams, activeFilters, clearFilters } = useServerColumns({
    columns: COLUMNS,
    defaultOrdering: DEFAULT_ORDERING,
  });
  const savedView = useSavedViewParams({ search, setSearch });
  // A tab's count is its filters plus the live search, and picking a tab keeps that search.
  const useViewCount = (viewParams) =>
    useGetOrdersQuery(
      { ...viewParams, search: debouncedSearch || viewParams.search, page: 1, page_size: 1 },
      { selectFromResult: ({ data }) => ({ count: data?.count }) }
    ).count;

  const searchParam = debouncedSearch || undefined;
  // Filters only saved views set (no column header): ShipTurtle, POS-processable, suggested units.
  const viewFilters = Object.fromEntries(
    VIEW_FILTERS.map((key) => [key, searchParams.get(key) || undefined])
  );
  const { data, isFetching, error, refetch } = useGetOrdersQuery({
    ...viewFilters,
    page,
    ordering: orderingParam,
    ...filterParams,
    search: searchParam,
  });
  // Held visible for a moment even when the API answers instantly, so the user sees something happened.
  const loading = useMinimumLoading(isFetching);
  const rows = data?.rows ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="mb-4 shrink-0 text-sm text-muted-foreground">
        Every order from every channel, reconciled against one inventory ledger.
      </p>

      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Input
            placeholder="Search order, invoice, customer, city…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pr-9"
          />
          {(search !== debouncedSearch || loading) && (
            <Loader2
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-label="Searching"
            />
          )}
        </div>
        <ViewFilterChips table={table} keys={VIEW_ONLY_FILTERS} />
        <SavedViews resource="orders" params={savedView.params} onApply={savedView.applyKeepingSearch} useCount={useViewCount} ignoreParams={["search"]} />
        {activeFilters > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={clearFilters}
          >
            Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}
          </Button>
        )}
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
      ) : rows.length === 0 && activeFilters === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No orders found"
          description="New orders will show up here the moment a customer checks out on any channel."
        />
      ) : (
        // See InventoryList.jsx's own comment for why overflow-hidden lands
        // here and min-h-0/flex-1 on the nested [data-slot=table-container].
        <div
          aria-busy={loading}
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl ring-1 ring-border [&>[data-slot=table-container]]:min-h-0 [&>[data-slot=table-container]]:flex-1"
        >
          {loading && (
            <div className="absolute inset-x-0 top-0 z-20 h-[3px] overflow-hidden bg-primary/15">
              <div className="animate-indeterminate h-full w-1/3 bg-primary" />
            </div>
          )}
          <Table className="table-scroll [&_td]:px-1.5 [&_th]:px-1.5">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {table.getHeaderGroups()[0].headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: `${header.column.columnDef.size}%` }}
                    className={"h-10 shadow-[inset_0_-1px_0_0_var(--border)]" + (header.column.columnDef.align === "right" ? " text-right" : "")}
                  >
                    {header.column.columnDef.header && (
                      <ColumnHeader
                        column={header.column}
                        title={flexRender(header.column.columnDef.header, header.getContext())}
                        align={header.column.columnDef.align}
                      />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className={loading ? "pointer-events-none opacity-50 transition-opacity" : "transition-opacity"}>
              {rows.length === 0 && <TableEmptyRow colSpan={COLUMN_COUNT} />}
              {rows.map((row) => {
                const isExpanded = expandedIds.has(row.id);
                const destination = [row.shipping_city, row.shipping_pincode].filter(Boolean).join(" · ");
                const itemsLabel = row.item_qty == null ? "—" : String(row.item_qty);
                const itemsTitle = row.line_count == null ? undefined : `${row.line_count} ${row.line_count === 1 ? "line" : "lines"}, ${row.item_qty} qty`;
                // An order can carry several POS invoices (comma-separated): show the first, hint at the rest.
                const invoices = (row.invoice_id || "").split(",").map((i) => i.trim()).filter(Boolean);
                const invoiceLabel = invoices.length === 0 ? "—" : invoices.length > 1 ? `${invoices[0]} …` : invoices[0];
                // Cancelled orders read as struck through (badges stay legible).
                const strike = row.status === "cancelled" ? " line-through decoration-muted-foreground/70 text-muted-foreground" : "";
                return (
                  <Fragment key={row.id}>
                    <TableRow>
                      <TableCell className="py-1">
                        <Button variant="ghost" size="icon-sm" className="size-5" onClick={() => toggleExpanded(row.id)}>
                          {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                          <span className="sr-only">{isExpanded ? "Hide line items" : "Show line items"}</span>
                        </Button>
                      </TableCell>
                      <TableCell className="py-1 font-mono text-xs">
                        <Link
                          to={`/orders/${row.id}`}
                          state={{ orderIds: rows.map((r) => r.id), from: location.pathname + location.search, search }}
                          className={row.status === "cancelled" ? "hover:underline" + strike : "text-primary hover:underline"}
                          title={row.external_order_id}
                        >
                          {row.order_name || row.external_order_id}
                        </Link>
                      </TableCell>
                      <TableCell className={"truncate py-1 font-mono text-xs" + strike} title={row.invoice_id || undefined}>{invoiceLabel}</TableCell>
                      <TableCell className={"truncate py-1 text-xs" + strike}>{formatPlacedDate(row.placed_at ?? row.created_at)}</TableCell>
                      <TableCell className="py-1">
                        <ChannelBadge channel={row.channel} className="status-chip--compact" />
                      </TableCell>
                      <TableCell className={"truncate py-1 text-xs" + strike} title={row.customer_name || undefined}>{row.customer_name || "—"}</TableCell>
                      <TableCell className={"py-1 font-mono text-xs tabular-nums" + strike} title={itemsTitle}>{itemsLabel}</TableCell>
                      <TableCell className={"py-1 text-right font-mono text-xs tabular-nums" + strike}>
                        {Number(row.total_amount ?? 0).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="py-1">
                        <StatusBadge tone={orderTone(row.status)} className="status-chip--compact">{row.status}</StatusBadge>
                      </TableCell>
                      <TableCell className="py-1">
                        {row.payment_status ? (
                          <StatusBadge tone={paymentTone(row.payment_status)} className="status-chip--compact">{row.payment_status}</StatusBadge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="py-1">
                        <StatusBadge tone={fulfillmentTone(row.fulfillment_status)} className="status-chip--compact">{row.fulfillment_status}</StatusBadge>
                      </TableCell>
                      <TableCell className={"truncate py-1 text-xs" + strike} title={row.delivery_method || undefined}>{row.delivery_method || "—"}</TableCell>
                      <TableCell className={"truncate py-1 text-xs" + strike} title={destination || undefined}>{destination || "—"}</TableCell>
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
        <Pagination page={page} pageSize={PAGE_SIZE} count={data?.count ?? 0} onPageChange={setPage} loading={loading} />
      </div>
    </div>
  );
}
