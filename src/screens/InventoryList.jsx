import { Fragment, useEffect, useMemo, useState } from "react";
import { Boxes, PackageOpen } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { TableEmptyRow } from "../components/TableEmptyRow.jsx";
import { ColumnHeader } from "../components/ColumnHeader.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import Pagination from "../components/Pagination.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import {
  useGetInventoryLedgerQuery,
  useGetInventoryLocationSummaryQuery,
  useGetInventoryUnitsQuery,
} from "../api/services/inventory.js";
import ViewFilterChips from "../components/ViewFilterChips.jsx";
import { useServerColumns } from "../hooks/useServerColumns.js";
import SavedViews from "../components/SavedViews.jsx";
import { useSavedViewParams } from "../hooks/useSavedViewParams.js";
import { formatApiError } from "../lib/errors.js";
import { stockLevel } from "../lib/status.js";

const PAGE_SIZE = 50;

const LEVEL_OPTIONS = [
  { value: "out", label: "Out of stock" },
  { value: "low", label: "Low stock" },
  { value: "in", label: "In stock" },
];
// Column ids are the backend's ?ordering= keys (apps.inventory.filters).
const COLUMNS = [
  { id: "product", header: "Product" },
  { id: "item_code", header: "Item code" },
  { id: "available", header: "Available" },
  { id: "level", enableSorting: false, meta: { label: "Level", filterOptions: LEVEL_OPTIONS, filterParam: "level" } },
];

// InventoryUnit.Status choices — apps.inventory.models.
function unitStatusTone(status) {
  switch (status) {
    case "in_stock":
      return "success";
    case "reserved":
      return "pending";
    case "sold":
      return "info";
    case "damaged":
      return "danger";
    default:
      return "neutral";
  }
}

function useDebounced(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function groupBySku(rows) {
  const groups = [];
  // Keyed by sku_id (the variant's own pk, always present), not the
  // item_code slug — item_code is null for a keyless variant, which would
  // otherwise collapse every such product into one bogus group.
  const bySkuId = new Map();
  for (const row of rows) {
    let group = bySkuId.get(row.sku_id);
    if (!group) {
      group = {
        sku_id: row.sku_id,
        item_code: row.sku,
        product_title: row.product_title,
        rows: [],
        totalAvailable: 0,
      };
      bySkuId.set(row.sku_id, group);
      groups.push(group);
    }
    group.rows.push(row);
    group.totalAvailable += row.available_qty;
  }
  return groups;
}

const UNITS_PAGE_SIZE = 50;

// Row total for a saved view's tab: a one-row page, only its `count` is read. The screen's `location` tab is the API's `location_id`.
const useViewCount = ({ location, ...params }) =>
  useGetInventoryLedgerQuery(
    { ...params, location_id: location || undefined, page: 1, page_size: 1 },
    { selectFromResult: ({ data }) => ({ count: data?.count }) }
  ).count;

const UNIT_STATUS_LABELS = {
  in_stock: "In stock",
  in_transit: "In transit",
  reserved: "Reserved",
  sold: "Sold",
  returned: "Returned",
  damaged: "Damaged",
};

// POS never changes a unit's status when it runs out; qty 0 is the real signal.
function unitStatus(unit) {
  if (unit.qty === 0 && unit.status === "in_stock") return { label: "Empty", tone: "neutral" };
  return { label: UNIT_STATUS_LABELS[unit.status] ?? unit.status, tone: unitStatusTone(unit.status) };
}

function UnitsDrawer({ target, onOpenChange }) {
  const [page, setPage] = useState(1);
  const [hideEmpty, setHideEmpty] = useState(true);
  // A different SKU/location (or filter) starts again from the first page.
  useEffect(() => setPage(1), [target?.skuId, target?.locationId, hideEmpty]);
  const scope = target ? { sku_id: target.skuId, location_id: target.locationId ?? undefined } : undefined;
  const { data, isFetching, error } = useGetInventoryUnitsQuery(
    scope ? { ...scope, page, min_qty: hideEmpty ? 1 : undefined } : undefined,
    { skip: !target }
  );
  // Two cheap first-page reads give the header its "with stock / empty" split.
  const { data: allUnits } = useGetInventoryUnitsQuery(scope ? { ...scope, page: 1 } : undefined, { skip: !target });
  const { data: stocked } = useGetInventoryUnitsQuery(scope ? { ...scope, page: 1, min_qty: 1 } : undefined, {
    skip: !target,
  });
  const rows = data?.rows ?? [];
  const count = data?.count ?? 0;
  const showLocation = target && !target.locationId;
  const title = target?.itemCode && target.itemCode !== "#N/A" ? target.itemCode : target?.productTitle;

  return (
    <Sheet open={Boolean(target)} onOpenChange={onOpenChange}>
      {/* Default sheet width (sm:max-w-sm, 24rem) x1.4 — this table
          (barcode/ownership/status/qty) is cramped at the default width. */}
      <SheetContent className="data-[side=right]:sm:max-w-[33.6rem]">
        <SheetHeader>
          {/* item_code can be null (keyless variant) — fall back to the
              product title so the header is never blank. */}
          <SheetTitle>Units — {title}</SheetTitle>
          <SheetDescription>
            {target?.locationLabel ? `At ${target.locationLabel}` : "Across every location"}
            {allUnits && stocked
              ? ` · ${stocked.count} with stock · ${allUnits.count - stocked.count} empty`
              : ""}
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-2 px-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{formatApiError(error)}</AlertDescription>
            </Alert>
          )}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="oms-checkbox"
              checked={hideEmpty}
              onChange={(e) => setHideEmpty(e.target.checked)}
            />
            Hide empty units (qty 0)
          </label>
          {isFetching && !data && <Skeleton className="h-24 w-full" />}
          {!isFetching && !error && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {hideEmpty ? "No units with stock. Untick “Hide empty units” to see empty ones." : "No units found."}
            </p>
          )}
          {rows.length > 0 && (
            <div
              aria-busy={isFetching}
              className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg ring-1 ring-border [&>[data-slot=table-container]]:min-h-0 [&>[data-slot=table-container]]:flex-1"
            >
              <Table className="table-compact table-fixed [&_td]:py-1 [&_td]:text-xs [&_th]:h-10">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={`${showLocation ? "w-[26%]" : "w-[34%]"} shadow-[inset_0_-1px_0_0_var(--border)]`}>Barcode</TableHead>
                    {showLocation && <TableHead className="w-[22%] shadow-[inset_0_-1px_0_0_var(--border)]">Location</TableHead>}
                    <TableHead className={`${showLocation ? "w-[20%]" : "w-[26%]"} shadow-[inset_0_-1px_0_0_var(--border)]`}>Ownership</TableHead>
                    <TableHead className={`${showLocation ? "w-[20%]" : "w-[28%]"} shadow-[inset_0_-1px_0_0_var(--border)]`}>Status</TableHead>
                    <TableHead className="w-[12%] text-center shadow-[inset_0_-1px_0_0_var(--border)]">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className={isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}>
                  {rows.map((unit) => {
                    const status = unitStatus(unit);
                    return (
                    <TableRow key={unit.id}>
                      <TableCell className="truncate font-mono">{unit.barcode}</TableCell>
                      {showLocation && <TableCell className="truncate">{unit.location}</TableCell>}
                      <TableCell className="truncate capitalize">{unit.ownership_type}</TableCell>
                      <TableCell>
                        <StatusBadge tone={status.tone} className="status-chip--compact">
                          {status.label}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-center font-mono tabular-nums">{unit.qty}</TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="shrink-0">
            <Pagination page={page} pageSize={UNITS_PAGE_SIZE} count={count} onPageChange={setPage} loading={isFetching} />
          </div>
        </div>
        <SheetFooter />
      </SheetContent>
    </Sheet>
  );
}

export default function InventoryList() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);

  // Page and location both live in the URL (?page=/?location=), not
  // component state — a refresh (or a shared/bookmarked link) lands back
  // on the same page AND tab instead of resetting either.
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page")) || 1;
  const locationParam = searchParams.get("location");
  const locationId = locationParam ? Number(locationParam) : null; // null = "All"

  const updateParams = (updates) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(updates)) {
          if (value === null || value === undefined) {
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
  // [search, locationId] — that also fires on mount (and React.StrictMode's
  // dev-only double-invoke defeats any ref-based "skip the first run"
  // guard), clobbering ?page=/?location= from a refreshed/shared URL.
  const handleSearchChange = (value) => {
    setSearch(value);
    setPage(1);
  };
  const handleLocationChange = (id) => {
    updateParams({ location: id, page: null });
  };

  const searchParam = debouncedSearch || undefined;
  const { table, orderingParam, filterParams, activeFilters, clearFilters } = useServerColumns({
    columns: COLUMNS,
    defaultOrdering: "item_code",
  });
  const savedView = useSavedViewParams({ search, setSearch });
  const { data, isFetching, error, refetch } = useGetInventoryLedgerQuery({
    page,
    search: searchParam,
    location_id: locationId ?? undefined,
    ordering: orderingParam,
    ...filterParams,
  });
  const { data: locationSummary } = useGetInventoryLocationSummaryQuery({ search: searchParam, ...filterParams });

  // "All" groups by item code (a sku can span several locations); a
  // specific location tab shows one flat row per sku — grouping would
  // just be one group per row, adding nothing.
  const groups = useMemo(() => (locationId === null ? groupBySku(data?.rows ?? []) : []), [data, locationId]);
  const flatRows = data?.rows ?? [];
  const totalCount = useMemo(() => (locationSummary ?? []).reduce((sum, l) => sum + l.count, 0), [locationSummary]);

  const isEmpty = locationId === null ? groups.length === 0 : flatRows.length === 0;

  const [unitsTarget, setUnitsTarget] = useState(null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="mb-4 shrink-0 text-sm text-muted-foreground">
        {locationId === null
          ? "One (SKU, location) row per pair, grouped by item code — the same ledger every channel's availability is pushed from."
          : "Every SKU stocked at this location — the same ledger every channel's availability is pushed from."}
      </p>

      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <Input
          placeholder="Search item code, location…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full"
        />
        <ViewFilterChips table={table} />
        <SavedViews resource="inventory" params={savedView.params} onApply={savedView.apply} useCount={useViewCount} />
        {activeFilters > 0 && (
          <Button size="sm" variant="outline" onClick={clearFilters}>
            Clear filter
          </Button>
        )}
      </div>

      <div className="mb-3 flex shrink-0 flex-wrap gap-1 border-b border-border">
        <button
          onClick={() => handleLocationChange(null)}
          className={
            "rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
            (locationId === null
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground")
          }
        >
          All {locationSummary ? `(${totalCount})` : ""}
        </button>
        {(locationSummary ?? []).map((l) => (
          <button
            key={l.location_id}
            onClick={() => handleLocationChange(l.location_id)}
            className={
              "rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
              (locationId === l.location_id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {l.location} ({l.count})
          </button>
        ))}
      </div>

      {error ? (
        <EmptyState
          tone="danger"
          title="Couldn't load inventory"
          description={`${formatApiError(error)} — check that the backend is reachable, then try again.`}
          action={
            <Button size="sm" variant="outline" onClick={refetch}>
              Try again
            </Button>
          }
        />
      ) : isFetching && !data ? (
        <Skeleton className="h-64 w-full" />
      ) : isEmpty && activeFilters === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No ledger rows found"
          description="Try a different search or location, or check that the ledger is populated."
        />
      ) : (
        // See ProductsList.jsx's own comment for why overflow-hidden lands
        // here and min-h-0/flex-1 on the nested [data-slot=table-container]
        // — same sticky-header-needs-a-bounded-scroll-container mechanics.
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl ring-1 ring-border [&>[data-slot=table-container]]:min-h-0 [&>[data-slot=table-container]]:flex-1">
          {/* table-fixed on both layouts — each has its own first column
              capped at 40% (Product/Location here, Product in the flat
              layout below), long content truncated with an ellipsis
              instead of overflowing or wrapping the row taller. */}
          <Table className="table-compact table-fixed [&_td]:py-1 [&_td]:text-xs [&_th]:h-10">
            {locationId === null ? (
              <>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[40%] shadow-[inset_0_-1px_0_0_var(--border)]">
                      <ColumnHeader column={table.getColumn("product")} title="Product/Location" />
                    </TableHead>
                    <TableHead className="shadow-[inset_0_-1px_0_0_var(--border)]">
                      <ColumnHeader column={table.getColumn("item_code")} title="Item code" />
                    </TableHead>
                    {/* Quantity sorts would scatter the per-sku groups, so they only apply to a location tab. */}
                    <TableHead className="shadow-[inset_0_-1px_0_0_var(--border)] text-center">Available</TableHead>
                    <TableHead className="shadow-[inset_0_-1px_0_0_var(--border)]">
                      <ColumnHeader column={table.getColumn("level")} title="Level" align="center" />
                    </TableHead>
                    <TableHead className="w-[10%] shadow-[inset_0_-1px_0_0_var(--border)]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isEmpty && <TableEmptyRow colSpan={5} />}
                  {groups.map((group) => {
                    const groupLevel = stockLevel(group.totalAvailable);
                    return (
                      <Fragment key={group.sku_id}>
                        {/* Same 5 columns as its child rows — item code once (not repeated per
                            location), Available the sum of every row below it. */}
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell className="truncate py-2 font-medium" title={group.product_title}>
                            {group.product_title}{" "}
                            <StatusBadge tone="neutral">
                              {group.rows.length} location{group.rows.length === 1 ? "" : "s"}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{group.item_code ?? "—"}</TableCell>
                          <TableCell className="text-center font-mono text-xs font-semibold tabular-nums">{group.totalAvailable}</TableCell>
                          <TableCell className="text-center">
                            <StatusBadge tone={groupLevel.tone}>{groupLevel.label}</StatusBadge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() =>
                                setUnitsTarget({
                                  skuId: group.sku_id,
                                  itemCode: group.item_code,
                                  productTitle: group.product_title,
                                  locationId: null,
                                  locationLabel: null,
                                })
                              }
                            >
                              <PackageOpen className="size-3.5" />
                              Units
                            </Button>
                          </TableCell>
                        </TableRow>
                        {group.rows.map((row) => {
                          const level = stockLevel(row.available_qty);
                          return (
                            <TableRow key={row.id}>
                              <TableCell className="truncate pl-6 text-sm" title={row.location}>
                                {row.location}
                              </TableCell>
                              <TableCell />
                              <TableCell className="text-center font-mono text-xs tabular-nums">{row.available_qty}</TableCell>
                              <TableCell className="text-center">
                                <StatusBadge tone={level.tone}>{level.label}</StatusBadge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() =>
                                    setUnitsTarget({
                                      skuId: group.sku_id,
                                      itemCode: group.item_code,
                                      productTitle: group.product_title,
                                      locationId: row.location_id,
                                      locationLabel: row.location,
                                    })
                                  }
                                >
                                  <PackageOpen className="size-3.5" />
                                  Units
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </>
            ) : (
              <>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[40%] shadow-[inset_0_-1px_0_0_var(--border)]">
                      <ColumnHeader column={table.getColumn("product")} title="Product" />
                    </TableHead>
                    <TableHead className="shadow-[inset_0_-1px_0_0_var(--border)]">
                      <ColumnHeader column={table.getColumn("item_code")} title="Item code" />
                    </TableHead>
                    <TableHead className="shadow-[inset_0_-1px_0_0_var(--border)]">
                      <ColumnHeader column={table.getColumn("available")} title="Available" align="center" />
                    </TableHead>
                    <TableHead className="shadow-[inset_0_-1px_0_0_var(--border)]">
                      <ColumnHeader column={table.getColumn("level")} title="Level" align="center" />
                    </TableHead>
                    <TableHead className="w-[10%] shadow-[inset_0_-1px_0_0_var(--border)]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isEmpty && <TableEmptyRow colSpan={5} />}
                  {flatRows.map((row) => {
                    const level = stockLevel(row.available_qty);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="truncate text-sm" title={row.product_title}>
                          {row.product_title}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.sku ?? "—"}</TableCell>
                        <TableCell className="text-center font-mono text-xs tabular-nums">{row.available_qty}</TableCell>
                        <TableCell className="text-center">
                          <StatusBadge tone={level.tone}>{level.label}</StatusBadge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() =>
                              setUnitsTarget({
                                skuId: row.sku_id,
                                itemCode: row.sku,
                                productTitle: row.product_title,
                                locationId: row.location_id,
                                locationLabel: row.location,
                              })
                            }
                          >
                            <PackageOpen className="size-3.5" />
                            Units
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </>
            )}
          </Table>
        </div>
      )}

      <div className="shrink-0">
        <Pagination page={page} pageSize={PAGE_SIZE} count={data?.count ?? 0} onPageChange={setPage} />
      </div>

      <UnitsDrawer target={unitsTarget} onOpenChange={(open) => !open && setUnitsTarget(null)} />
    </div>
  );
}
