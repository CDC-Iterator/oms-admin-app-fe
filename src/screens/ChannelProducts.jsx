import { Fragment, useEffect, useMemo, useState } from "react";
import { PackageSearch, RefreshCw, Unlink } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { ChannelBadge } from "../components/ChannelBadge.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import Pagination from "../components/Pagination.jsx";
import ReferencePickerDialog from "../components/ReferencePickerDialog.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Select } from "@/components/ui/select.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.jsx";
import {
  useGetProductsQuery,
  useRemoveChannelMappingMutation,
  useUpsertChannelMappingMutation,
} from "../api/services/catalog.js";
import { useGetChannelProductsQuery, useSyncChannelProductsMutation } from "../api/services/channelProducts.js";
import { useAuth } from "../hooks/useAuth.js";
import { useToast } from "../hooks/useToast.js";
import { formatApiError } from "../lib/errors.js";

const PAGE_SIZE = 50;

// StoreChannel.Name choices that are actually syncable channel-product
// sources — POS is deliberately excluded, same as every other "channel"
// context in this app (it's a sync source, never a push/browse target).
const CHANNELS = [
  { value: "", label: "All channels" },
  { value: "shopify", label: "Shopify" },
  { value: "tatacliq", label: "TataCliq" },
];

const MAPPED_FILTERS = [
  { value: "", label: "All" },
  { value: "true", label: "Mapped" },
  { value: "false", label: "Unmapped" },
];

function groupByProduct(rows) {
  const groups = [];
  const byProductId = new Map();
  for (const row of rows) {
    let group = byProductId.get(row.product_id);
    if (!group) {
      group = { product_id: row.product_id, ...row, variants: [] };
      byProductId.set(row.product_id, group);
      groups.push(group);
    }
    group.variants.push(row);
  }
  return groups;
}

function useDebounced(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// Groups /api/skus/ rows by style_code — same shape ProductsList.jsx's
// own groupByProduct already establishes.
function groupCatalogByProduct(rows) {
  const groups = [];
  const byStyleCode = new Map();
  for (const row of rows) {
    let group = byStyleCode.get(row.style_code);
    if (!group) {
      group = { key: row.style_code, title: row.title, subtitle: row.style_code, variants: [] };
      byStyleCode.set(row.style_code, group);
      groups.push(group);
    }
    group.variants.push({ key: row.id, ...row });
  }
  return groups;
}

function catalogVariantLabel(variant) {
  const opts = Object.values(variant.options ?? {}).filter(Boolean);
  return opts.length ? opts.join(" / ") : variant.item_code;
}

// Reference picker for one channel variant — replaces the old Sheet +
// item-code Select: pick a catalog row, the mapping saves immediately.
function CatalogMappingPicker({ target, onOpenChange, onMapped }) {
  const { showToast } = useToast();
  const [upsertMapping] = useUpsertChannelMappingMutation();
  const [search, setSearch] = useState(undefined);

  const { data, isFetching } = useGetProductsQuery({ search, active: true }, { skip: !target });
  const groups = useMemo(() => groupCatalogByProduct(data?.rows ?? []), [data]);

  if (!target) return null;

  const handleSelect = async (row) => {
    try {
      await upsertMapping({
        variantId: row.id,
        channel: target.channel,
        external_sku: target.external_sku,
        external_variant_id: target.external_variant_id,
      }).unwrap();
      showToast(`${target.external_sku} mapped to ${row.item_code}.`);
      onMapped();
    } catch (err) {
      showToast(formatApiError(err));
    }
  };

  return (
    <ReferencePickerDialog
      open={Boolean(target)}
      onOpenChange={onOpenChange}
      title={`Map ${target.external_sku} to a catalog item`}
      searchPlaceholder="Search item code, style, title…"
      onSearchChange={setSearch}
      isFetching={isFetching}
      groups={groups}
      onSelect={handleSelect}
      emptyTitle="No catalog items found"
      emptyDescription="Try a different search."
      renderVariant={(row) => (
        <>
          <span className="font-mono text-xs">{row.item_code}</span>
          <span className="text-xs text-muted-foreground">{catalogVariantLabel(row)}</span>
        </>
      )}
    />
  );
}

function UnmapConfirmDialog({ target, onOpenChange, onUnmapped }) {
  const { showToast } = useToast();
  const [removeMapping, { isLoading }] = useRemoveChannelMappingMutation();

  const handleConfirm = async () => {
    try {
      await removeMapping({ variantId: target.mapped_sku_id, channel: target.channel }).unwrap();
      showToast(`Mapping removed for ${target.external_sku}.`);
      onUnmapped();
    } catch (err) {
      showToast(formatApiError(err));
    }
  };

  return (
    <AlertDialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove mapping?</AlertDialogTitle>
          <AlertDialogDescription>
            {target?.external_sku} will no longer be linked to {target?.mapped_item_code}. You can re-map it later
            from either screen.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
          <Button variant="destructive" onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? "Removing…" : "Remove mapping"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function ChannelProducts() {
  const { user } = useAuth();
  const canSync = user?.is_superuser || user?.role === "admin";
  // Matches ProductsList.jsx's own gate — the channel-mappings write
  // endpoint is IsAdmin only, not superuser-inclusive like IsSuperAdmin.
  const canManageMappings = user?.role === "admin";
  const { showToast } = useToast();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);

  // Page and both tab dimensions live in the URL (?page=/?mapped=/
  // ?channel=) — see InventoryList.jsx's own comment for why page resets
  // happen in the tab-click/search handlers directly, not a
  // mount-firing useEffect.
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page")) || 1;
  const mapped = searchParams.get("mapped") || "";
  const channel = searchParams.get("channel") || "";

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
  const handleMappedFilterChange = (nextMapped) => updateParams({ mapped: nextMapped, page: null });
  const handleChannelTabChange = (nextChannel) => updateParams({ channel: nextChannel, page: null });
  const handleSearchChange = (value) => {
    setSearch(value);
    updateParams({ page: null });
  };

  const searchParam = debouncedSearch || undefined;
  const mappedParam = mapped || undefined;
  const channelParam = channel || undefined;
  const { data, isFetching, error, refetch } = useGetChannelProductsQuery({
    page,
    search: searchParam,
    mapped: mappedParam,
    channel: channelParam,
  });
  // Grouped within this page only — same known simplification
  // ProductsList.jsx's own groupByProduct already accepts.
  const groups = useMemo(() => groupByProduct(data?.rows ?? []), [data]);

  // Channel-tab counts hold the current mapped filter fixed, so they
  // still reflect whichever mapped state is currently selected.
  const { data: channelTabAll } = useGetChannelProductsQuery({ search: searchParam, mapped: mappedParam, page: 1 });
  const { data: channelTabShopify } = useGetChannelProductsQuery({
    search: searchParam,
    mapped: mappedParam,
    channel: "shopify",
    page: 1,
  });
  const { data: channelTabTatacliq } = useGetChannelProductsQuery({
    search: searchParam,
    mapped: mappedParam,
    channel: "tatacliq",
    page: 1,
  });
  const CHANNEL_TAB_COUNTS = { "": channelTabAll?.count, shopify: channelTabShopify?.count, tatacliq: channelTabTatacliq?.count };

  const [syncChannelProducts, { isLoading: isSyncing }] = useSyncChannelProductsMutation();
  const handleSync = async () => {
    try {
      await syncChannelProducts().unwrap();
      showToast("Sync started — refresh in a moment to see new/updated rows.");
    } catch (err) {
      showToast(formatApiError(err));
    }
  };

  const [mapTarget, setMapTarget] = useState(null);
  const [unmapTarget, setUnmapTarget] = useState(null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Every product/variant live on Shopify, mapped or not — proactive visibility, distinct from
          Unmapped SKUs (which only fills once an order arrives on an unresolved SKU).
        </p>
        {canSync && (
          <Button size="sm" variant="outline" onClick={handleSync} disabled={isSyncing}>
            <RefreshCw className={`size-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Starting…" : "Sync now"}
          </Button>
        )}
      </div>

      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <Input
          placeholder="Search product, vendor, SKU…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="flex-1"
        />
        <Select value={mapped} onChange={(e) => handleMappedFilterChange(e.target.value)}>
          {MAPPED_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="mb-3 flex shrink-0 flex-wrap gap-1 border-b border-border">
        {CHANNELS.map((c) => (
          <button
            key={c.value}
            onClick={() => handleChannelTabChange(c.value)}
            className={
              "rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
              (channel === c.value
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {c.label} {CHANNEL_TAB_COUNTS[c.value] !== undefined ? `(${CHANNEL_TAB_COUNTS[c.value]})` : ""}
          </button>
        ))}
      </div>

      {error ? (
        <EmptyState
          tone="danger"
          title="Couldn't load channel products"
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
        <EmptyState
          icon={PackageSearch}
          title="No channel products found"
          description={canSync ? "Try a different search, or run Sync now." : "Try a different search."}
        />
      ) : (
        // See InventoryList.jsx's own comment for why overflow-hidden lands
        // here and min-h-0/flex-1 on the nested [data-slot=table-container].
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl ring-1 ring-border [&>[data-slot=table-container]]:min-h-0 [&>[data-slot=table-container]]:flex-1">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[35%] border-b-2 border-border">Product</TableHead>
                <TableHead className="border-b-2 border-border">Channel</TableHead>
                <TableHead className="border-b-2 border-border">Vendor</TableHead>
                <TableHead className="border-b-2 border-border">SKU</TableHead>
                <TableHead className="border-b-2 border-border text-center">Price</TableHead>
                <TableHead className="w-[15%] border-b-2 border-border text-center">Mapping</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <Fragment key={group.product_id}>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell className="flex items-center gap-2 truncate py-2" title={group.product_title}>
                      {group.image_url ? (
                        <img src={group.image_url} alt="" className="size-8 shrink-0 rounded object-cover" />
                      ) : (
                        <div className="flex size-8 shrink-0 items-center justify-center rounded bg-muted">
                          <PackageSearch className="size-3.5 text-muted-foreground" />
                        </div>
                      )}
                      <span className="truncate font-medium">{group.product_title || "—"}</span>{" "}
                      <StatusBadge tone="neutral">
                        {group.variants.length} variant{group.variants.length === 1 ? "" : "s"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <ChannelBadge channel={group.channel} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{group.vendor || "—"}</TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell />
                  </TableRow>
                  {group.variants.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="pl-6" />
                      <TableCell />
                      <TableCell />
                      <TableCell className="font-mono text-xs">{row.external_sku || "—"}</TableCell>
                      <TableCell className="text-center font-mono text-xs tabular-nums">
                        {row.price ? Number(row.price).toLocaleString("en-IN") : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {canManageMappings ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setMapTarget(row)}
                              className="rounded px-1 py-0.5 hover:bg-accent"
                            >
                              {row.mapped_item_code ? (
                                <StatusBadge tone="success">{row.mapped_item_code}</StatusBadge>
                              ) : (
                                <StatusBadge tone="pending">Unmapped</StatusBadge>
                              )}
                            </button>
                            {row.mapped_item_code && (
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <button
                                      type="button"
                                      onClick={() => setUnmapTarget(row)}
                                      className="shrink-0 rounded p-0.5 hover:bg-accent"
                                    />
                                  }
                                >
                                  <Unlink className="size-3.5 text-muted-foreground" />
                                  <span className="sr-only">Remove mapping</span>
                                </TooltipTrigger>
                                <TooltipContent>Remove mapping</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        ) : row.mapped_item_code ? (
                          <StatusBadge tone="success">{row.mapped_item_code}</StatusBadge>
                        ) : (
                          <StatusBadge tone="pending">Unmapped</StatusBadge>
                        )}
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
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          count={data?.count ?? 0}
          onPageChange={(nextPage) => updateParams({ page: nextPage <= 1 ? null : nextPage })}
        />
      </div>

      <CatalogMappingPicker
        target={mapTarget}
        onOpenChange={(open) => !open && setMapTarget(null)}
        onMapped={() => setMapTarget(null)}
      />
      <UnmapConfirmDialog
        target={unmapTarget}
        onOpenChange={(open) => !open && setUnmapTarget(null)}
        onUnmapped={() => setUnmapTarget(null)}
      />
    </div>
  );
}
