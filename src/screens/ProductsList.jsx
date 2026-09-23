import { Fragment, useEffect, useMemo, useState } from "react";
import { Boxes, Check, PackageSearch, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { EmptyState } from "../components/empty-state.jsx";
import Pagination from "../components/Pagination.jsx";
import ReferencePickerDialog from "../components/ReferencePickerDialog.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.jsx";
import { useGetProductsQuery, useUpsertChannelMappingMutation } from "../api/services/catalog.js";
import { useGetChannelProductsQuery } from "../api/services/channelProducts.js";
import { useGetInventoryLedgerQuery } from "../api/services/inventory.js";
import { useAuth } from "../hooks/useAuth.js";
import { useToast } from "../hooks/useToast.js";
import { formatApiError } from "../lib/errors.js";
import { stockLevel } from "../lib/status.js";

const PAGE_SIZE = 50;
const CHANNELS = [
  { key: "shopify", label: "Shopify" },
  { key: "tatacliq", label: "TataCliq" },
];

function useDebounced(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function groupByProduct(rows) {
  const groups = [];
  const byStyleCode = new Map();
  for (const row of rows) {
    let group = byStyleCode.get(row.style_code);
    if (!group) {
      group = { style_code: row.style_code, title: row.title, variants: [] };
      byStyleCode.set(row.style_code, group);
      groups.push(group);
    }
    group.variants.push(row);
  }
  return groups;
}

function variantLabel(variant) {
  const opts = Object.values(variant.options ?? {}).filter(Boolean);
  return opts.length ? opts.join(" / ") : variant.item_code;
}

function MappingCell({ variant, channelKey, canManageMappings, onClick }) {
  const mapping = variant.mappings?.[channelKey];
  const content = (
    <>
      {mapping ? (
        <Check className="size-4 shrink-0 text-[color-mix(in_srgb,var(--status-success)_70%,black)]" />
      ) : (
        <X className="size-4 shrink-0 text-muted-foreground" />
      )}
      {mapping && (
        <span className="truncate font-mono text-xs text-muted-foreground" title={mapping.external_sku}>
          {mapping.external_sku}
        </span>
      )}
    </>
  );
  if (!canManageMappings) {
    return <div className="flex items-center justify-center gap-1.5">{content}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded px-1 py-0.5 hover:bg-accent"
    >
      {content}
    </button>
  );
}

// Groups a /api/channels/products/ page by product_id — same shape
// ChannelProducts.jsx's own groupByProduct already establishes.
function groupChannelProductsByProduct(rows) {
  const groups = [];
  const byProductId = new Map();
  for (const row of rows) {
    let group = byProductId.get(row.product_id);
    if (!group) {
      group = { key: row.product_id, title: row.product_title, subtitle: row.vendor, imageUrl: row.image_url, variants: [] };
      byProductId.set(row.product_id, group);
      groups.push(group);
    }
    group.variants.push({ key: row.external_variant_id, ...row });
  }
  return groups;
}

// Reference picker for one (catalog variant, channel) pair — replaces
// the old free-text mapping form: pick a row, the mapping is saved
// immediately, no separate "Save" step.
function ChannelMappingPicker({ target, onOpenChange, onMapped }) {
  const { showToast } = useToast();
  const [upsertMapping] = useUpsertChannelMappingMutation();
  const [search, setSearch] = useState(undefined);

  const { data, isFetching } = useGetChannelProductsQuery(
    { channel: target?.channelKey, search },
    { skip: !target }
  );
  const groups = useMemo(() => groupChannelProductsByProduct(data?.rows ?? []), [data]);

  if (!target) return null;
  const channelLabel = CHANNELS.find((c) => c.key === target.channelKey)?.label;

  const handleSelect = async (row) => {
    try {
      await upsertMapping({
        variantId: target.variant.id,
        channel: target.channelKey,
        external_sku: row.external_sku,
        external_variant_id: row.external_variant_id,
      }).unwrap();
      showToast(`${target.variant.item_code} mapped to ${row.external_sku} (${channelLabel}).`);
      onMapped();
    } catch (err) {
      showToast(formatApiError(err));
    }
  };

  return (
    <ReferencePickerDialog
      open={Boolean(target)}
      onOpenChange={onOpenChange}
      title={`Map ${target.variant.item_code} on ${channelLabel}`}
      searchPlaceholder={`Search ${channelLabel} products…`}
      onSearchChange={setSearch}
      isFetching={isFetching}
      groups={groups}
      onSelect={handleSelect}
      emptyTitle="No synced products found"
      emptyDescription={`Run "Sync now" on Channel Products to pull the latest ${channelLabel} catalog.`}
      renderVariant={(row) => (
        <>
          <span className="font-mono text-xs">{row.external_sku}</span>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            {row.price ? Number(row.price).toLocaleString("en-IN") : ""}
            {row.mapped_item_code && <StatusBadge tone="pending">mapped to {row.mapped_item_code}</StatusBadge>}
          </span>
        </>
      )}
    />
  );
}

function InventorySheet({ open, onOpenChange, variant }) {
  const { data, isFetching, error } = useGetInventoryLedgerQuery({ sku: variant?.item_code }, { skip: !variant });
  const rows = data?.rows ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Inventory — {variant?.item_code}</SheetTitle>
          <SheetDescription>
            {variant?.title} · {variant ? variantLabel(variant) : ""}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-3 px-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{formatApiError(error)}</AlertDescription>
            </Alert>
          )}
          {isFetching && <Skeleton className="h-24 w-full" />}
          {!isFetching && rows.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">No ledger rows for this item yet.</p>
          )}
          {!isFetching && rows.length > 0 && (
            <div className="overflow-hidden rounded-lg ring-1 ring-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-8 text-[0.65rem]">Location</TableHead>
                    <TableHead className="h-8 text-[0.65rem]">Available / On hand</TableHead>
                    <TableHead className="h-8 text-[0.65rem]">Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const level = stockLevel(r.available_qty);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{r.location}</TableCell>
                        <TableCell className="font-mono text-xs tabular-nums">
                          {r.available_qty} / {r.on_hand_qty}
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={level.tone}>{level.label}</StatusBadge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

export default function ProductsList() {
  const { user } = useAuth();
  const canManageMappings = user?.role === "admin";

  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);

  // Page lives in the URL (?page=), not component state — a refresh (or a
  // shared/bookmarked link) lands back on the same page instead of
  // silently resetting to 1.
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page")) || 1;
  const setPage = (nextPage) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (nextPage <= 1) {
          next.delete("page");
        } else {
          next.set("page", String(nextPage));
        }
        return next;
      },
      { replace: true }
    );
  };

  // Page resets to 1 from the tab/search handlers directly (below), not a
  // useEffect keyed on [tab, debouncedSearch] — that also fires on mount
  // (and StrictMode's dev-only double-invoke defeats any ref-based "skip
  // the first run" guard), clobbering ?page= from a refreshed/shared URL.
  const handleTabChange = (nextTab) => {
    setTab(nextTab);
    setPage(1);
  };
  const handleSearchChange = (value) => {
    setSearch(value);
    setPage(1);
  };

  const searchParam = debouncedSearch || undefined;
  const activeParams = { page, search: searchParam, unmapped: tab === "unmapped" ? true : undefined };
  const { data, isFetching, error, refetch } = useGetProductsQuery(activeParams);
  const { data: allCount } = useGetProductsQuery({ search: searchParam, page: 1 });
  const { data: unmappedCount } = useGetProductsQuery({ search: searchParam, unmapped: true, page: 1 });

  const groups = useMemo(() => groupByProduct(data?.rows ?? []), [data]);

  const [mappingTarget, setMappingTarget] = useState(null);
  const [inventoryTarget, setInventoryTarget] = useState(null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="mb-4 shrink-0 text-sm text-muted-foreground">The catalog as POS 2.0 mirrors it, grouped by product.</p>

      {/* border-b lives on this full-width row, not the tab-button group
          alone, so the baseline spans edge-to-edge — each tab's own
          border-b-2 (the active indicator) sits flush on top of it since
          items-end bottom-aligns both children to the same line. */}
      <div className="mb-3 flex shrink-0 flex-wrap items-end justify-between gap-2 border-b border-border">
        <div className="flex flex-wrap gap-1">
          {[
            { key: "all", label: "All", count: allCount?.count },
            { key: "unmapped", label: "Unmapped SKUs", count: unmappedCount?.count },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={
                "rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
                (tab === t.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {t.label} {t.count !== undefined ? `(${t.count})` : ""}
            </button>
          ))}
        </div>
        <Input
          placeholder="Search item code, style, title, Shopify/TataCliq ID…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="mb-1.5 max-w-80"
        />
      </div>

      {error ? (
        <EmptyState
          tone="danger"
          title="Couldn't load products"
          description={`${formatApiError(error)} — try again.`}
          action={
            <Button size="sm" variant="outline" onClick={refetch}>
              Try again
            </Button>
          }
        />
      ) : isFetching && !data ? (
        <Skeleton className="h-64 w-full" />
      ) : groups.length === 0 ? (
        <EmptyState icon={PackageSearch} title="No products found" description="Try a different search or tab." />
      ) : (
        // <Table>'s own wrapper div (ui/table.jsx) sets overflow-x-auto,
        // which the browser coerces to overflow-y:auto too (CSS overflow
        // computed-value rule) — making THAT div, not this one, the
        // nearest scrolling ancestor sticky positioning resolves against.
        // So the bounded height/flex has to land on that inner div (via
        // this arbitrary-child selector), not on an extra wrapper here,
        // or the header has nothing to actually stick within.
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl ring-1 ring-border [&>[data-slot=table-container]]:min-h-0 [&>[data-slot=table-container]]:flex-1">
          <Table className="table-fixed">
            {/* Border lives on each <th> (a <tr>'s own border-bottom is
                only honored under border-collapse:collapse, which this
                table doesn't use — a per-cell border always renders). */}
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[45%] border-b-2 border-border">Variant</TableHead>
                <TableHead className="w-[15%] border-b-2 border-border">Item code</TableHead>
                <TableHead className="w-[15%] border-b-2 border-border text-center">Shopify</TableHead>
                <TableHead className="w-[15%] border-b-2 border-border text-center">TataCliq</TableHead>
                <TableHead className="w-[10%] border-b-2 border-border">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <Fragment key={group.style_code}>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={5} className="py-2">
                      <span className="font-medium">{group.title}</span>{" "}
                      <span className="font-mono text-xs text-muted-foreground">{group.style_code}</span>{" "}
                      <StatusBadge tone="neutral">{group.variants.length} variant{group.variants.length === 1 ? "" : "s"}</StatusBadge>
                    </TableCell>
                  </TableRow>
                  {group.variants.map((variant) => (
                    <TableRow key={variant.id}>
                      <TableCell className="truncate pl-6 text-sm" title={variantLabel(variant)}>
                        {variantLabel(variant)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{variant.item_code}</TableCell>
                      <TableCell>
                        <MappingCell
                          variant={variant}
                          channelKey="shopify"
                          canManageMappings={canManageMappings}
                          onClick={() => setMappingTarget({ variant, channelKey: "shopify" })}
                        />
                      </TableCell>
                      <TableCell>
                        <MappingCell
                          variant={variant}
                          channelKey="tatacliq"
                          canManageMappings={canManageMappings}
                          onClick={() => setMappingTarget({ variant, channelKey: "tatacliq" })}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-start gap-1.5">
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button variant="outline" size="icon-sm" onClick={() => setInventoryTarget(variant)} />
                              }
                            >
                              <Boxes className="size-3.5" />
                              <span className="sr-only">Inventory</span>
                            </TooltipTrigger>
                            <TooltipContent>Inventory</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="shrink-0">
        <Pagination page={page} pageSize={PAGE_SIZE} count={data?.count ?? 0} onPageChange={setPage} />
      </div>

      <ChannelMappingPicker
        target={mappingTarget}
        onOpenChange={(open) => !open && setMappingTarget(null)}
        onMapped={() => setMappingTarget(null)}
      />
      <InventorySheet
        open={Boolean(inventoryTarget)}
        onOpenChange={(open) => !open && setInventoryTarget(null)}
        variant={inventoryTarget}
      />
    </div>
  );
}
