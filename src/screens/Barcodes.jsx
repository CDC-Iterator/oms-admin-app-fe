import { useEffect, useMemo, useState } from "react";
import { flexRender } from "@tanstack/react-table";
import { Loader2, ScanBarcode } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { ColumnHeader } from "../components/ColumnHeader.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import Pagination from "../components/Pagination.jsx";
import SavedViews from "../components/SavedViews.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import { TableEmptyRow } from "../components/TableEmptyRow.jsx";
import ViewFilterChips from "../components/ViewFilterChips.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { useGetInventoryUnitsQuery } from "../api/services/inventory.js";
import { useGetLocationsQuery } from "../api/services/locations.js";
import { useMinimumLoading } from "../hooks/useMinimumLoading.js";
import { useSavedViewParams } from "../hooks/useSavedViewParams.js";
import { useServerColumns } from "../hooks/useServerColumns.js";
import { formatApiError } from "../lib/errors.js";
import { unitStatus } from "../lib/status.js";

const PAGE_SIZE = 50;
const DEFAULT_ORDERING = "item_code";

// Row total for a saved view's tab: a one-row page, only its `count` is read.
const useViewCount = (params) =>
  useGetInventoryUnitsQuery({ ...params, page: 1, page_size: 1 }, { selectFromResult: ({ data }) => ({ count: data?.count }) }).count;

// ?status= values of /api/inventory/units/ (apps.inventory.filters.InventoryUnitFilter).
const STATUSES = [
  { value: "in_stock", label: "In stock" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "in_transit", label: "In transit" },
  { value: "reserved", label: "Reserved" },
  { value: "sold", label: "Sold" },
  { value: "returned", label: "Returned" },
  { value: "damaged", label: "Damaged" },
];
const OWNERSHIPS = [
  { value: "own", label: "Own" },
  { value: "consignment", label: "Consignment" },
];

const formatWhen = (value) =>
  new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function useDebounced(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function Barcodes() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);

  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page")) || 1;
  const setPage = (next) =>
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next <= 1) params.delete("page");
        else params.set("page", String(next));
        return params;
      },
      { replace: true }
    );
  const handleSearchChange = (value) => {
    setSearch(value);
    setPage(1);
  };

  const { data: locationData } = useGetLocationsQuery();
  const locations = locationData?.rows;
  // Column ids are the backend's ?ordering= keys: item_code (the default) groups a SKU's barcodes together,
  // barcode/location/ownership/status sort within each SKU, and qty/updated sort the whole list.
  const columns = useMemo(
    () => [
      { id: "item_code", header: "Item code", size: 11 },
      { id: "product", header: "Product", size: 22, enableSorting: false },
      { id: "barcode", header: "Barcode", size: 15 },
      {
        id: "location",
        header: "Location",
        size: 14,
        meta: { filterOptions: (locations ?? []).map((l) => ({ value: String(l.id), label: l.name })), filterParam: "location_id" },
      },
      { id: "ownership", header: "Ownership", size: 10, meta: { filterOptions: OWNERSHIPS, filterParam: "ownership_type" } },
      { id: "status", header: "Status", size: 11, meta: { filterOptions: STATUSES, filterParam: "status" } },
      { id: "qty", header: "Qty", size: 6 },
      { id: "updated", header: "Updated", size: 11 },
    ],
    [locations]
  );

  const { table, orderingParam, filterParams, activeFilters, clearFilters } = useServerColumns({
    columns,
    defaultOrdering: DEFAULT_ORDERING,
  });
  const savedView = useSavedViewParams({ search, setSearch });
  const { data, isFetching, error, refetch } = useGetInventoryUnitsQuery({
    page,
    ordering: orderingParam,
    ...filterParams,
    search: debouncedSearch || undefined,
  });
  const loading = useMinimumLoading(isFetching);
  const rows = data?.rows ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="mb-4 shrink-0 text-sm text-muted-foreground">
        Every barcode (unit) POS has reported, one row per barcode and location. Sorted by item code, a SKU's barcodes stay together; sort by Qty or Updated to rank the whole list.
      </p>

      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Input
            placeholder="Search barcode, item code or product…"
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
        <ViewFilterChips table={table} />
        <SavedViews resource="barcodes" params={savedView.params} onApply={savedView.apply} useCount={useViewCount} />
        {activeFilters > 0 && (
          <Button size="sm" variant="outline" onClick={clearFilters}>
            Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}
          </Button>
        )}
      </div>

      {error ? (
        <EmptyState
          tone="danger"
          title="Couldn't load barcodes"
          description={`${formatApiError(error)} — try again.`}
          action={
            <Button size="sm" variant="outline" onClick={refetch}>
              Try again
            </Button>
          }
        />
      ) : isFetching && !data ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 && activeFilters === 0 && !debouncedSearch ? (
        <EmptyState icon={ScanBarcode} title="No barcodes yet" description="Units appear here as POS inventory events arrive." />
      ) : (
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
                    className="h-10 shadow-[inset_0_-1px_0_0_var(--border)]"
                  >
                    <ColumnHeader
                      column={header.column}
                      title={flexRender(header.column.columnDef.header, header.getContext())}
                    />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className={loading ? "pointer-events-none opacity-50 transition-opacity" : "transition-opacity"}>
              {rows.length === 0 && <TableEmptyRow colSpan={columns.length} />}
              {rows.map((unit) => {
                const status = unitStatus(unit);
                return (
                  <TableRow key={unit.id}>
                    <TableCell className="truncate py-1 font-mono text-xs">{unit.sku ?? "—"}</TableCell>
                    <TableCell className="truncate py-1 text-xs" title={unit.product}>
                      {unit.product}
                    </TableCell>
                    <TableCell className="truncate py-1 font-mono text-xs">{unit.barcode}</TableCell>
                    <TableCell className="truncate py-1 text-xs">{unit.location}</TableCell>
                    <TableCell className="truncate py-1 text-xs capitalize">{unit.ownership_type}</TableCell>
                    <TableCell className="py-1">
                      <StatusBadge tone={status.tone} className="status-chip--compact">
                        {status.label}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="py-1 font-mono text-xs tabular-nums">{unit.qty}</TableCell>
                    <TableCell className="truncate py-1 font-mono text-xs">{formatWhen(unit.updated_at)}</TableCell>
                  </TableRow>
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
