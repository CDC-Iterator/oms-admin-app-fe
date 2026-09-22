import { Fragment, useEffect, useMemo, useState } from "react";
import { Boxes, Check, Link2, PackageSearch, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { EmptyState } from "../components/empty-state.jsx";
import Pagination from "../components/Pagination.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.jsx";
import { useGetProductsQuery, useUpsertChannelMappingMutation } from "../api/services/catalog.js";
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

function MappingCell({ variant, channelKey }) {
  const mapping = variant.mappings?.[channelKey];
  return (
    <div className="flex items-center justify-center gap-1.5">
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
    </div>
  );
}

function MappingForm({ open, onOpenChange, variant, onSaved }) {
  const { showToast } = useToast();
  const [upsertMapping, { isLoading }] = useUpsertChannelMappingMutation();
  const [channel, setChannel] = useState(CHANNELS[0].key);
  const [externalSku, setExternalSku] = useState("");
  const [externalVariantId, setExternalVariantId] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!variant) return;
    const existing = variant.mappings?.[channel];
    setExternalSku(existing?.external_sku ?? "");
    setExternalVariantId(existing?.external_variant_id ?? "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, channel, open]);

  if (!variant) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    try {
      await upsertMapping({
        variantId: variant.id,
        channel,
        external_sku: externalSku,
        external_variant_id: externalVariantId || undefined,
      }).unwrap();
      showToast(`${variant.item_code} mapped to ${channel}.`);
      onSaved?.();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Manage mapping — {variant.item_code}</SheetTitle>
          <SheetDescription>{variant.title} · {variantLabel(variant)}</SheetDescription>
        </SheetHeader>
        <form id="mapping-form" className="flex flex-1 flex-col gap-4 px-4" onSubmit={handleSubmit}>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label>Channel</Label>
            <div className="flex gap-1.5">
              {CHANNELS.map((c) => (
                <Button
                  key={c.key}
                  type="button"
                  size="sm"
                  variant={channel === c.key ? "default" : "outline"}
                  onClick={() => setChannel(c.key)}
                >
                  {c.label}
                  {variant.mappings?.[c.key] && <Check className="size-3.5" />}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="external_sku">External SKU</Label>
            <Input id="external_sku" value={externalSku} onChange={(e) => setExternalSku(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="external_variant_id">External variant ID (optional)</Label>
            <Input id="external_variant_id" value={externalVariantId} onChange={(e) => setExternalVariantId(e.target.value)} />
          </div>
        </form>
        <SheetFooter>
          <Button type="submit" form="mapping-form" disabled={isLoading || !externalSku.trim()}>
            {isLoading ? "Saving…" : "Save mapping"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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
                        <MappingCell variant={variant} channelKey="shopify" />
                      </TableCell>
                      <TableCell>
                        <MappingCell variant={variant} channelKey="tatacliq" />
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
                          {canManageMappings && (
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button variant="outline" size="icon-sm" onClick={() => setMappingTarget(variant)} />
                                }
                              >
                                <Link2 className="size-3.5" />
                                <span className="sr-only">Manage mapping</span>
                              </TooltipTrigger>
                              <TooltipContent>Manage mapping</TooltipContent>
                            </Tooltip>
                          )}
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

      <MappingForm
        open={Boolean(mappingTarget)}
        onOpenChange={(open) => !open && setMappingTarget(null)}
        variant={mappingTarget}
        onSaved={() => setMappingTarget(null)}
      />
      <InventorySheet
        open={Boolean(inventoryTarget)}
        onOpenChange={(open) => !open && setInventoryTarget(null)}
        variant={inventoryTarget}
      />
    </div>
  );
}
