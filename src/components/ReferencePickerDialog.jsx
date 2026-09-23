import { useEffect, useState } from "react";
import { PackageSearch, Search } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { EmptyState } from "./empty-state.jsx";

function useDebounced(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// Generic "search, then pick one variant" dialog — Shopify's own "Select
// products" modal is the visual reference. Data-source agnostic: used to
// pick a channel (Shopify/TataCliq) variant AND to pick a catalog
// (Product Master) variant, from two different screens.
export default function ReferencePickerDialog({
  open,
  onOpenChange,
  title,
  searchPlaceholder = "Search…",
  onSearchChange,
  isFetching,
  groups,
  renderVariant,
  onSelect,
  emptyTitle = "No results",
  emptyDescription = "Try a different search.",
}) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);

  useEffect(() => {
    onSearchChange?.(debouncedSearch || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] w-full max-w-xl flex-col gap-3 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="relative shrink-0">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg ring-1 ring-border">
          {isFetching ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : groups.length === 0 ? (
            <EmptyState icon={PackageSearch} title={emptyTitle} description={emptyDescription} />
          ) : (
            groups.map((group) => (
              <div key={group.key}>
                <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
                  {group.imageUrl ? (
                    <img src={group.imageUrl} alt="" className="size-6 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="flex size-6 shrink-0 items-center justify-center rounded bg-muted">
                      <PackageSearch className="size-3 text-muted-foreground" />
                    </div>
                  )}
                  <span className="truncate text-sm font-medium">{group.title}</span>
                  {group.subtitle && <span className="truncate text-xs text-muted-foreground">{group.subtitle}</span>}
                </div>
                {group.variants.map((variant) => (
                  <button
                    key={variant.key}
                    type="button"
                    onClick={() => onSelect(variant)}
                    className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 pl-8 text-left text-sm last:border-0 hover:bg-accent"
                  >
                    {renderVariant(variant)}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
