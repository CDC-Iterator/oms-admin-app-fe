import { useEffect, useState } from "react";
import { flexRender } from "@tanstack/react-table";
import { Activity, Loader2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { ChannelBadge } from "../components/ChannelBadge.jsx";
import { ColumnHeader } from "../components/ColumnHeader.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import Pagination from "../components/Pagination.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import { TableEmptyRow } from "../components/TableEmptyRow.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { useGetActivityQuery } from "../api/services/activity.js";
import ViewFilterChips from "../components/ViewFilterChips.jsx";
import { useMinimumLoading } from "../hooks/useMinimumLoading.js";
import SavedViews from "../components/SavedViews.jsx";
import { useSavedViewParams } from "../hooks/useSavedViewParams.js";
import { useServerColumns } from "../hooks/useServerColumns.js";
import { formatApiError } from "../lib/errors.js";
import { syncTone } from "../lib/status.js";

const PAGE_SIZE = 50;

// Row total for a saved view's tab: a one-row page, only its `count` is read.
const useViewCount = (params) =>
  useGetActivityQuery({ ...params, page: 1, page_size: 1 }, { selectFromResult: ({ data }) => ({ count: data?.count }) }).count;

// SyncLog.Direction/Status/channel choices — apps.inventory.models, apps.channels.models.
const CHANNELS = [
  { value: "shopify", label: "Shopify" },
  { value: "tatacliq", label: "TataCliq" },
  { value: "pos", label: "POS" },
];
const DIRECTIONS = [
  { value: "push", label: "Push" },
  { value: "pull", label: "Pull" },
];
const STATUSES = [
  { value: "success", label: "Success" },
  { value: "retrying", label: "Retrying" },
  { value: "failed", label: "Failed" },
];

// TanStack column ids are the backend's ?ordering= keys / filter params (apps.inventory.views.SyncLogViewSet).
const COLUMNS = [
  { id: "channel", header: "Channel", size: 9, meta: { filterOptions: CHANNELS, filterParam: "channel" } },
  { id: "direction", header: "Direction", size: 9, meta: { filterOptions: DIRECTIONS, filterParam: "direction" } },
  { id: "topic", header: "Topic", size: 20 },
  { id: "summary", header: "Details", size: 22, enableSorting: false },
  { id: "status", header: "Status", size: 10, meta: { filterOptions: STATUSES, filterParam: "status" } },
  { id: "error", header: "Error", size: 14, enableSorting: false },
  { id: "timestamp", header: "When", size: 16 },
];
const COLUMN_COUNT = COLUMNS.length;
const DEFAULT_ORDERING = "-timestamp";

const formatWhen = (value) =>
  new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });

function useDebounced(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function DetailRow({ label, children }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

function ActivityDrawer({ row, onClose }) {
  return (
    <Sheet open={Boolean(row)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-[52rem]">
        {row && (
          <>
            <SheetHeader>
              <SheetTitle className="font-mono text-sm">{row.topic}</SheetTitle>
              <SheetDescription>{new Date(row.timestamp).toLocaleString()}</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-4 pb-6">
              <dl className="grid grid-cols-[7rem_1fr] items-center gap-x-4 gap-y-2.5 text-sm">
                <DetailRow label="Channel">
                  <ChannelBadge channel={row.channel} />
                </DetailRow>
                <DetailRow label="Direction">{row.direction}</DetailRow>
                <DetailRow label="Status">
                  <StatusBadge tone={syncTone(row.status)}>{row.status}</StatusBadge>
                </DetailRow>
                {row.summary && <DetailRow label="Details">{row.summary}</DetailRow>}
              </dl>
              {row.error && (
                <section>
                  <h3 className="mb-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">Error</h3>
                  <pre className="max-h-72 overflow-auto rounded-md bg-destructive/10 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                    {row.error}
                  </pre>
                </section>
              )}
              <section>
                <h3 className="mb-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">Payload</h3>
                <pre className="max-h-[65vh] overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
                  {Object.keys(row.payload ?? {}).length ? JSON.stringify(row.payload, null, 2) : "No payload recorded"}
                </pre>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function ActivityLog() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const [selected, setSelected] = useState(null);

  // Page lives in the URL (?page=) so a refresh or shared link lands on the same page.
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

  const { table, orderingParam, filterParams, activeFilters, clearFilters } = useServerColumns({
    columns: COLUMNS,
    defaultOrdering: DEFAULT_ORDERING,
  });
  const savedView = useSavedViewParams({ search, setSearch });
  const { data, isFetching, error, refetch } = useGetActivityQuery({
    page,
    ordering: orderingParam,
    ...filterParams,
    topic: searchParams.get("topic") || undefined,
    since_hours: searchParams.get("since_hours") || undefined,
    search: debouncedSearch || undefined,
  });
  const loading = useMinimumLoading(isFetching);
  const rows = data?.rows ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="mb-4 shrink-0 text-sm text-muted-foreground">
        Every POS/channel sync attempt — inbound reads and outbound pushes, with outcome. Click a row for the full record.
      </p>

      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Input
            placeholder="Search topic or error…"
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
        <ViewFilterChips table={table} keys={["topic", "since_hours"]} />
        <SavedViews resource="activity" params={savedView.params} onApply={savedView.apply} useCount={useViewCount} />
        {activeFilters > 0 && (
          <Button size="sm" variant="outline" onClick={clearFilters}>
            Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}
          </Button>
        )}
      </div>

      {error ? (
        <EmptyState
          tone="danger"
          title="Couldn't load activity"
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
        <EmptyState icon={Activity} title="No activity yet" description="Every sync push and fetch will show up here as it happens." />
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
          <Table className="min-w-[1000px] table-fixed [&_td]:px-1.5 [&_th]:px-1.5">
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
              {rows.length === 0 && <TableEmptyRow colSpan={COLUMN_COUNT} />}
              {rows.map((row) => (
                <TableRow key={row.id} className="cursor-pointer" onClick={() => setSelected(row)}>
                  <TableCell className="py-1">
                    <ChannelBadge channel={row.channel} className="status-chip--compact" />
                  </TableCell>
                  <TableCell className="py-1 text-xs capitalize">{row.direction}</TableCell>
                  <TableCell className="truncate py-1 font-mono text-xs" title={row.topic}>
                    {row.topic}
                  </TableCell>
                  <TableCell className="truncate py-1 text-xs" title={row.summary || undefined}>
                    {row.summary || "—"}
                  </TableCell>
                  <TableCell className="py-1">
                    <StatusBadge tone={syncTone(row.status)} className="status-chip--compact">
                      {row.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="truncate py-1 text-xs text-muted-foreground" title={row.error || undefined}>
                    {row.error || "—"}
                  </TableCell>
                  <TableCell className="truncate py-1 font-mono text-xs">{formatWhen(row.timestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="shrink-0">
        <Pagination page={page} pageSize={PAGE_SIZE} count={data?.count ?? 0} onPageChange={setPage} loading={loading} />
      </div>

      <ActivityDrawer row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
