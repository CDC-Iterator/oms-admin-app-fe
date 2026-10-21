import { useEffect, useMemo, useState } from "react";
import { PackageCheck, Truck } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { ColumnHeader } from "../components/ColumnHeader.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import { TableEmptyRow } from "../components/TableEmptyRow.jsx";
import { LineProduct } from "../components/LineProduct.jsx";
import Pagination from "../components/Pagination.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Select } from "@/components/ui/select.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { useGetInventoryLocationSummaryQuery } from "../api/services/inventory.js";
import { useBookFulfillmentLinesMutation, useGetFulfillmentLinesQuery } from "../api/services/orders.js";
import { useAuth } from "../hooks/useAuth.js";
import { useServerColumns } from "../hooks/useServerColumns.js";
import { formatApiError } from "../lib/errors.js";
import { formatPlacedDate } from "../lib/utils.js";

const PAGE_SIZE = 50;
// Column widths live on a <colgroup> so the table keeps its layout when the action bar replaces the header.
const COLUMN_WIDTHS = [3, 22, 8, 10, 9, 3, 10, 11, 10, 7, 7];
const COURIERS = [
  { value: "shipway", label: "Shipway" },
  { value: "shipdelight", label: "Shipdelight" },
  { value: "quicklee", label: "Quicklee" },
];
const COLUMNS = [
  { id: "item_code", header: "Item" },
  { id: "order", header: "Order", meta: { filterIds: true, filterParam: "order_ids" } },
  { id: "placed_at", header: "Date" },
];

function useDebounced(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// Every order line that still has to go out and already has a unit confirmed — a flat pick list, not one row per order.
export default function FulfillmentLines() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page")) || 1;
  const { data: locations } = useGetInventoryLocationSummaryQuery({});
  const columns = useMemo(
    () => [
      ...COLUMNS,
      {
        id: "allocated_location",
        enableSorting: false,
        meta: {
          filterParam: "allocated_location_id",
          filterOptions: (locations ?? []).map((l) => ({ value: String(l.location_id), label: l.location })),
        },
      },
    ],
    [locations]
  );
  const { table, orderingParam, filterParams, activeFilters, clearFilters } = useServerColumns({
    columns,
    defaultOrdering: "-placed_at",
  });

  const updateParams = (updates) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(updates)) {
          if (value === null || value === undefined || value === "") next.delete(key);
          else next.set(key, String(value));
        }
        return next;
      },
      { replace: true }
    );
  const setPage = (nextPage) => updateParams({ page: nextPage <= 1 ? null : nextPage });

  const { data, isFetching, error, refetch } = useGetFulfillmentLinesQuery({
    page,
    search: debouncedSearch || undefined,
    ...filterParams,
    ordering: orderingParam,
  });
  const rows = data?.rows ?? [];

  // Selection is by line id (kept with its row, for the booking summary) and survives paging;
  // the header box toggles the lines on the current page.
  const [selected, setSelected] = useState(() => new Map());
  const toggle = (row) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(row.line_id)) next.delete(row.line_id);
      else next.set(row.line_id, row);
      return next;
    });
  const pageSelected = rows.length > 0 && rows.every((r) => selected.has(r.line_id));
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Map(prev);
      for (const r of rows) {
        if (pageSelected) next.delete(r.line_id);
        else next.set(r.line_id, r);
      }
      return next;
    });

  const { user } = useAuth();
  const isAdmin = user?.is_superuser || user?.role === "admin";
  const [bookOpen, setBookOpen] = useState(false);
  const [courier, setCourier] = useState("shipway");
  const [bookResult, setBookResult] = useState(null);
  const [book, { isLoading: booking, error: bookError }] = useBookFulfillmentLinesMutation();
  // One shipment per order and warehouse — the same grouping the server uses.
  const shipmentCount = new Set([...selected.values()].map((r) => `${r.order_id}:${r.units[0]?.location_id}`)).size;
  const orderCount = new Set([...selected.values()].map((r) => r.order_id)).size;
  const closeBook = () => {
    setBookOpen(false);
    if (bookResult?.queued?.length) setSelected(new Map());
    setBookResult(null);
  };
  const submitBook = async () => {
    try {
      setBookResult(await book({ courier, line_ids: [...selected.keys()] }).unwrap());
    } catch {
      /* shown from bookError */
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="mb-4 shrink-0 text-sm text-muted-foreground">
        Order lines still to fulfil that already have a confirmed unit
        {data ? ` — ${data.count} line${data.count === 1 ? "" : "s"}` : ""}.
      </p>

      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <Input
          placeholder="Search order, invoice, customer, item, barcode…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="min-w-48 flex-1"
        />
        {activeFilters > 0 && (
          <Button size="sm" variant="outline" onClick={clearFilters}>
            Clear filter
          </Button>
        )}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {formatApiError(error)}{" "}
            <Button size="sm" variant="outline" onClick={refetch}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : isFetching && !data ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 && activeFilters === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="Nothing to fulfil"
          description="Lines show up here once they have a confirmed unit and haven't shipped yet."
        />
      ) : (
        <div
          aria-busy={isFetching}
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl ring-1 ring-border [&>[data-slot=table-container]]:min-h-0 [&>[data-slot=table-container]]:flex-1"
        >
          <Table className="min-w-[1200px] table-compact table-fixed [&_td]:py-1 [&_td]:text-xs [&_th]:h-10">
            <colgroup>
              {COLUMN_WIDTHS.map((w, i) => (
                <col key={i} style={{ width: `${w}%` }} />
              ))}
            </colgroup>
            <TableHeader>
              {selected.size > 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableHead colSpan={11} className="bg-muted/40 shadow-[inset_0_-1px_0_0_var(--border)]">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="oms-checkbox"
                        checked
                        onChange={() => setSelected(new Map())}
                        aria-label="Clear selection"
                      />
                      <span className="text-sm font-medium">
                        {selected.size} selected
                      </span>
                      {isAdmin && (
                        <Button size="sm" variant="outline" onClick={() => setBookOpen(true)}>
                          <Truck className="size-3.5" />
                          Book shipments
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setSelected(new Map())}>
                        Clear selection
                      </Button>
                    </div>
                  </TableHead>
                </TableRow>
              )}
              <TableRow className={selected.size > 0 ? "hidden" : "hover:bg-transparent"}>
                <TableHead className="w-[3%] shadow-[inset_0_-1px_0_0_var(--border)]">
                  <input
                    type="checkbox"
                    className="oms-checkbox"
                    checked={pageSelected}
                    onChange={togglePage}
                    aria-label="Select all lines on this page"
                  />
                </TableHead>
                <TableHead className="w-[22%] shadow-[inset_0_-1px_0_0_var(--border)]">
                  <ColumnHeader column={table.getColumn("item_code")} title="Item" />
                </TableHead>
                <TableHead className="w-[8%] shadow-[inset_0_-1px_0_0_var(--border)]">
                  <ColumnHeader column={table.getColumn("order")} title="Order" />
                </TableHead>
                <TableHead className="w-[10%] shadow-[inset_0_-1px_0_0_var(--border)]">Invoice</TableHead>
                <TableHead className="w-[9%] shadow-[inset_0_-1px_0_0_var(--border)]">
                  <ColumnHeader column={table.getColumn("placed_at")} title="Date" />
                </TableHead>
                <TableHead className="w-[3%] shadow-[inset_0_-1px_0_0_var(--border)] text-center">Qty</TableHead>
                <TableHead className="w-[10%] shadow-[inset_0_-1px_0_0_var(--border)]">Barcode</TableHead>
                <TableHead className="w-[11%] shadow-[inset_0_-1px_0_0_var(--border)]">
                  <ColumnHeader column={table.getColumn("allocated_location")} title="Allocated location" />
                </TableHead>
                <TableHead className="w-[10%] shadow-[inset_0_-1px_0_0_var(--border)]">Customer</TableHead>
                <TableHead className="w-[7%] shadow-[inset_0_-1px_0_0_var(--border)]">Delivery</TableHead>
                <TableHead className="w-[7%] shadow-[inset_0_-1px_0_0_var(--border)]">Destination</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className={isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}>
              {rows.length === 0 && <TableEmptyRow colSpan={11} />}
              {rows.map((row) => (
                <TableRow key={row.line_id} data-state={selected.has(row.line_id) ? "selected" : undefined}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="oms-checkbox"
                      checked={selected.has(row.line_id)}
                      onChange={() => toggle(row)}
                      aria-label={`Select ${row.order_name} ${row.external_sku}`}
                    />
                  </TableCell>
                  <TableCell>
                    <LineProduct line={row} layout="card" dense />
                  </TableCell>
                  <TableCell className="font-mono">
                    <Link to={`/orders/${row.order_id}`} className="text-primary hover:underline" title={row.customer_name}>
                      {row.order_name}
                    </Link>
                  </TableCell>
                  <TableCell className="truncate font-mono" title={row.invoice_id || undefined}>
                    {row.invoice_id || "—"}
                  </TableCell>
                  <TableCell className="truncate">{formatPlacedDate(row.placed_at)}</TableCell>
                  <TableCell className="text-center font-mono tabular-nums">{row.qty}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.units.map((u) => (
                        <StatusBadge key={u.barcode} tone="success" className="status-chip--compact">
                          {u.barcode}
                        </StatusBadge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="truncate" title={row.allocated_location || undefined}>
                    {row.allocated_location || "—"}
                  </TableCell>
                  <TableCell className="truncate" title={row.customer_name || undefined}>
                    {row.customer_name || "—"}
                  </TableCell>
                  <TableCell className="truncate" title={row.delivery_method || undefined}>
                    {row.delivery_method || "—"}
                  </TableCell>
                  <TableCell
                    className="truncate"
                    title={[row.shipping_city, row.shipping_pincode].filter(Boolean).join(" · ") || undefined}
                  >
                    {[row.shipping_city, row.shipping_pincode].filter(Boolean).join(" · ") || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="shrink-0">
        <Pagination page={page} pageSize={PAGE_SIZE} count={data?.count ?? 0} onPageChange={setPage} loading={isFetching} />
      </div>

      <Dialog open={bookOpen} onOpenChange={(open) => (open ? setBookOpen(true) : closeBook())}>
        <DialogContent className="flex max-h-[80vh] w-full max-w-lg flex-col gap-3 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Book shipments</DialogTitle>
            <DialogDescription>
              {selected.size} line{selected.size === 1 ? "" : "s"} across {orderCount} order{orderCount === 1 ? "" : "s"} —{" "}
              {shipmentCount} shipment{shipmentCount === 1 ? "" : "s"}, one per order and warehouse.
            </DialogDescription>
          </DialogHeader>

          {bookResult ? (
            <div className="min-h-0 space-y-2 overflow-y-auto text-sm">
              <p className="font-medium">
                {bookResult.queued.length} shipment{bookResult.queued.length === 1 ? "" : "s"} queued with {courier}.
              </p>
              <ul className="space-y-1 text-xs">
                {bookResult.queued.map((q) => (
                  <li key={`${q.order_id}-${q.location}`} className="font-mono">
                    {q.order_name} · {q.location} · {q.weight_kg} kg
                  </li>
                ))}
              </ul>
              {bookResult.skipped.length > 0 && (
                <>
                  <p className="pt-1 font-medium text-destructive">{bookResult.skipped.length} skipped</p>
                  <ul className="space-y-1 text-xs">
                    {bookResult.skipped.map((k, i) => (
                      <li key={i}>
                        <span className="font-mono">{k.order_name ?? `line ${k.line_id}`}</span> — {k.reason}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="text-xs text-muted-foreground">
                Booking runs in the background — the lines leave this list once the courier confirms.
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <label className="block space-y-1">
                <span className="text-xs font-medium">Courier</span>
                <Select value={courier} onChange={(e) => setCourier(e.target.value)} className="w-full">
                  {COURIERS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </label>
              <p className="text-xs text-muted-foreground">
                Parcel weight is each shipment's lines (Shopify weight × quantity). A shipment whose lines have no
                weight is skipped — book it from the order page.
              </p>
              {bookError && <p className="text-xs text-destructive">{formatApiError(bookError)}</p>}
            </div>
          )}

          <DialogFooter>
            {bookResult ? (
              <Button onClick={closeBook}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={closeBook} disabled={booking}>
                  Cancel
                </Button>
                <Button onClick={submitBook} disabled={booking}>
                  {booking ? "Booking…" : `Book ${shipmentCount} shipment${shipmentCount === 1 ? "" : "s"}`}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
