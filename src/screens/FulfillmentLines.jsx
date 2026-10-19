import { useEffect, useState } from "react";
import { PackageCheck } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { ColumnHeader } from "../components/ColumnHeader.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import { LineProduct } from "../components/LineProduct.jsx";
import Pagination from "../components/Pagination.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Checkbox } from "@/components/ui/checkbox.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Select } from "@/components/ui/select.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { useGetInventoryLocationSummaryQuery } from "../api/services/inventory.js";
import { useGetFulfillmentLinesQuery } from "../api/services/orders.js";
import { useServerColumns } from "../hooks/useServerColumns.js";
import { formatApiError } from "../lib/errors.js";
import { formatPlacedDate } from "../lib/utils.js";

const PAGE_SIZE = 50;
const COLUMNS = [
  { id: "order", header: "Order" },
  { id: "placed_at", header: "Date" },
  { id: "item_code", header: "Item" },
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
  const locationId = searchParams.get("location_id") || "";
  const { table, orderingParam } = useServerColumns({ columns: COLUMNS, defaultOrdering: "-placed_at" });

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

  const { data: locations } = useGetInventoryLocationSummaryQuery({});
  const { data, isFetching, error, refetch } = useGetFulfillmentLinesQuery({
    page,
    search: debouncedSearch || undefined,
    location_id: locationId || undefined,
    ordering: orderingParam,
  });
  const rows = data?.rows ?? [];

  // Selection is by line id and survives paging; the header box toggles the lines on the current page.
  const [selected, setSelected] = useState(() => new Set());
  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const pageSelected = rows.length > 0 && rows.every((r) => selected.has(r.line_id));
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of rows) {
        if (pageSelected) next.delete(r.line_id);
        else next.add(r.line_id);
      }
      return next;
    });

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
        <Select value={locationId} onChange={(e) => updateParams({ location_id: e.target.value, page: null })}>
          <option value="">All locations</option>
          {(locations ?? []).map((l) => (
            <option key={l.location_id} value={l.location_id}>
              {l.location}
            </option>
          ))}
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex shrink-0 items-center gap-3 rounded-lg bg-muted/50 px-3 py-1.5 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <Button size="xs" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </div>
      )}

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
      ) : rows.length === 0 ? (
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
          <Table className="table-compact table-fixed [&_td]:py-1 [&_td]:text-xs [&_th]:h-7">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[3%] border-b-2 border-border">
                  <Checkbox checked={pageSelected} onCheckedChange={togglePage} aria-label="Select all lines on this page" />
                </TableHead>
                <TableHead className="w-[9%] border-b-2 border-border">
                  <ColumnHeader column={table.getColumn("order")} title="Order" />
                </TableHead>
                <TableHead className="w-[12%] border-b-2 border-border">Invoice</TableHead>
                <TableHead className="w-[11%] border-b-2 border-border">
                  <ColumnHeader column={table.getColumn("placed_at")} title="Date" />
                </TableHead>
                <TableHead className="w-[28%] border-b-2 border-border">
                  <ColumnHeader column={table.getColumn("item_code")} title="Item" />
                </TableHead>
                <TableHead className="w-[4%] border-b-2 border-border text-center">Qty</TableHead>
                <TableHead className="w-[15%] border-b-2 border-border">Barcode</TableHead>
                <TableHead className="w-[18%] border-b-2 border-border">Allocated location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className={isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}>
              {rows.map((row) => (
                <TableRow key={row.line_id} data-state={selected.has(row.line_id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(row.line_id)}
                      onCheckedChange={() => toggle(row.line_id)}
                      aria-label={`Select ${row.order_name} ${row.external_sku}`}
                    />
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
                  <TableCell>
                    <LineProduct line={row} layout="card" />
                  </TableCell>
                  <TableCell className="text-center font-mono tabular-nums">{row.qty}</TableCell>
                  <TableCell className="font-mono">
                    {row.units.map((u) => u.barcode).join(", ")}
                  </TableCell>
                  <TableCell className="truncate" title={row.allocated_location || undefined}>
                    {row.allocated_location || "—"}
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
    </div>
  );
}
