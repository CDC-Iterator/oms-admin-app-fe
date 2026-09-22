import { Fragment, useEffect, useMemo, useState } from "react";
import { Boxes, PackageOpen } from "lucide-react";
import { useSearchParams } from "react-router-dom";

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
import { formatApiError } from "../lib/errors.js";
import { stockLevel } from "../lib/status.js";

const PAGE_SIZE = 50;

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
  const byItemCode = new Map();
  for (const row of rows) {
    let group = byItemCode.get(row.sku);
    if (!group) {
      group = { item_code: row.sku, product_title: row.product_title, rows: [], totalCommitted: 0, totalAvailable: 0, totalOnHand: 0 };
      byItemCode.set(row.sku, group);
      groups.push(group);
    }
    group.rows.push(row);
    group.totalCommitted += row.committed_qty;
    group.totalAvailable += row.available_qty;
    group.totalOnHand += row.on_hand_qty;
  }
  return groups;
}

function UnitsDrawer({ target, onOpenChange }) {
  const { data, isFetching, error } = useGetInventoryUnitsQuery(
    target ? { sku: target.sku, location_id: target.locationId ?? undefined } : undefined,
    { skip: !target }
  );
  const rows = data?.rows ?? [];

  return (
    <Sheet open={Boolean(target)} onOpenChange={onOpenChange}>
      {/* Default sheet width (sm:max-w-sm, 24rem) x1.4 — this table
          (barcode/ownership/status/qty) is cramped at the default width. */}
      <SheetContent className="data-[side=right]:sm:max-w-[33.6rem]">
        <SheetHeader>
          <SheetTitle>Units — {target?.sku}</SheetTitle>
          <SheetDescription>
            {target?.locationLabel ? `At ${target.locationLabel}` : "Across every location"}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-3 px-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{formatApiError(error)}</AlertDescription>
            </Alert>
          )}
          {isFetching && <Skeleton className="h-24 w-full" />}
          {!isFetching && !error && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No units found.</p>
          )}
          {!isFetching && rows.length > 0 && (
            <div className="overflow-hidden rounded-lg ring-1 ring-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-8 text-[0.65rem]">Barcode</TableHead>
                    <TableHead className="h-8 text-[0.65rem]">Ownership</TableHead>
                    <TableHead className="h-8 text-[0.65rem]">Status</TableHead>
                    <TableHead className="h-8 text-center text-[0.65rem]">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell className="font-mono text-xs">{unit.barcode}</TableCell>
                      <TableCell className="text-xs capitalize">{unit.ownership_type}</TableCell>
                      <TableCell>
                        <StatusBadge tone={unitStatusTone(unit.status)}>{unit.status}</StatusBadge>
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs tabular-nums">{unit.qty}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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
  const { data, isFetching, error, refetch } = useGetInventoryLedgerQuery({
    page,
    search: searchParam,
    location_id: locationId ?? undefined,
  });
  const { data: locationSummary } = useGetInventoryLocationSummaryQuery({ search: searchParam });

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

      <Input
        placeholder="Search item code, location…"
        value={search}
        onChange={(e) => handleSearchChange(e.target.value)}
        className="mb-3 w-full shrink-0"
      />

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
      ) : isEmpty ? (
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
          <Table className="table-fixed">
            {locationId === null ? (
              <>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[40%] border-b-2 border-border">Product/Location</TableHead>
                    <TableHead className="border-b-2 border-border">Item code</TableHead>
                    <TableHead className="border-b-2 border-border text-center">Committed</TableHead>
                    <TableHead className="border-b-2 border-border text-center">Available</TableHead>
                    <TableHead className="border-b-2 border-border text-center">On hand</TableHead>
                    <TableHead className="border-b-2 border-border text-center">Level</TableHead>
                    <TableHead className="w-[10%] border-b-2 border-border">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => {
                    const groupLevel = stockLevel(group.totalAvailable);
                    return (
                      <Fragment key={group.item_code}>
                        {/* Same 7 columns as its child rows — Item
                            code/Committed/Available/On hand here are this
                            sku's own row (item code once, not repeated per
                            location) / the sum of every row below it. */}
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell className="truncate py-2 font-medium" title={group.product_title}>
                            {group.product_title}{" "}
                            <StatusBadge tone="neutral">
                              {group.rows.length} location{group.rows.length === 1 ? "" : "s"}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{group.item_code}</TableCell>
                          <TableCell className="text-center font-mono text-xs font-semibold tabular-nums">{group.totalCommitted}</TableCell>
                          <TableCell className="text-center font-mono text-xs font-semibold tabular-nums">{group.totalAvailable}</TableCell>
                          <TableCell className="text-center font-mono text-xs font-semibold tabular-nums">{group.totalOnHand}</TableCell>
                          <TableCell className="text-center">
                            <StatusBadge tone={groupLevel.tone}>{groupLevel.label}</StatusBadge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setUnitsTarget({ sku: group.item_code, locationId: null, locationLabel: null })}
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
                              <TableCell className="text-center font-mono text-xs tabular-nums">{row.committed_qty}</TableCell>
                              <TableCell className="text-center font-mono text-xs tabular-nums">{row.available_qty}</TableCell>
                              <TableCell className="text-center font-mono text-xs tabular-nums">{row.on_hand_qty}</TableCell>
                              <TableCell className="text-center">
                                <StatusBadge tone={level.tone}>{level.label}</StatusBadge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setUnitsTarget({ sku: group.item_code, locationId: row.location_id, locationLabel: row.location })
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
                    <TableHead className="w-[40%] border-b-2 border-border">Product</TableHead>
                    <TableHead className="border-b-2 border-border">Item code</TableHead>
                    <TableHead className="border-b-2 border-border text-center">Committed</TableHead>
                    <TableHead className="border-b-2 border-border text-center">Available</TableHead>
                    <TableHead className="border-b-2 border-border text-center">On hand</TableHead>
                    <TableHead className="border-b-2 border-border text-center">Level</TableHead>
                    <TableHead className="w-[10%] border-b-2 border-border">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flatRows.map((row) => {
                    const level = stockLevel(row.available_qty);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="truncate text-sm" title={row.product_title}>
                          {row.product_title}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                        <TableCell className="text-center font-mono text-xs tabular-nums">{row.committed_qty}</TableCell>
                        <TableCell className="text-center font-mono text-xs tabular-nums">{row.available_qty}</TableCell>
                        <TableCell className="text-center font-mono text-xs tabular-nums">{row.on_hand_qty}</TableCell>
                        <TableCell className="text-center">
                          <StatusBadge tone={level.tone}>{level.label}</StatusBadge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setUnitsTarget({ sku: row.sku, locationId: row.location_id, locationLabel: row.location })}
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
