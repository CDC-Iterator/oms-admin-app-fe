import { useEffect, useState } from "react";
import { flexRender } from "@tanstack/react-table";
import { FileDown, Loader2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { ColumnHeader } from "../components/ColumnHeader.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import Pagination from "../components/Pagination.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import { TableEmptyRow } from "../components/TableEmptyRow.jsx";
import ViewFilterChips from "../components/ViewFilterChips.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { useGetExportsQuery } from "../api/services/exports.js";
import { useExportDownload } from "../hooks/useExportDownload.js";
import { useMinimumLoading } from "../hooks/useMinimumLoading.js";
import { useServerColumns } from "../hooks/useServerColumns.js";
import { formatApiError } from "../lib/errors.js";
import {
  EXPORT_ACTIVE,
  EXPORT_POLL_MS,
  EXPORT_RESOURCES,
  EXPORT_STATUSES,
  EXPORT_TONE,
  exportDuration,
  exportParamsSummary,
  exportResourceLabel,
  formatExportWhen,
} from "../lib/exports.js";

const PAGE_SIZE = 50;

// Column ids only label the headers here (the list is always newest first); filter params are the API's.
const COLUMNS = [
  { id: "file", header: "File", size: 20, enableSorting: false },
  { id: "resource", header: "Screen", size: 9, enableSorting: false, meta: { filterOptions: EXPORT_RESOURCES, filterParam: "resource" } },
  { id: "filters", header: "Filters", size: 24, enableSorting: false },
  { id: "status", header: "Status", size: 9, enableSorting: false, meta: { filterOptions: EXPORT_STATUSES, filterParam: "status", filterMulti: true } },
  { id: "rows", header: "Rows", size: 7, enableSorting: false },
  { id: "created", header: "Started", size: 11, enableSorting: false },
  { id: "took", header: "Took", size: 7, enableSorting: false },
  { id: "action", header: "", size: 8, enableSorting: false },
];

function useDebounced(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function Exports() {
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

  const { table, filterParams, activeFilters, clearFilters } = useServerColumns({ columns: COLUMNS, defaultOrdering: "created" });
  const [polling, setPolling] = useState(false);
  const { data, isFetching, error, refetch } = useGetExportsQuery(
    { page, page_size: PAGE_SIZE, ...filterParams, search: debouncedSearch || undefined },
    { pollingInterval: polling ? EXPORT_POLL_MS : 0 }
  );
  const loading = useMinimumLoading(isFetching);
  const rows = data?.rows ?? [];
  const active = rows.filter((r) => EXPORT_ACTIVE.includes(r.status)).length;
  useEffect(() => setPolling(active > 0), [active]);
  const { download, downloading } = useExportDownload();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="mb-4 shrink-0 text-sm text-muted-foreground">
        CSV exports you started from the list screens. They build in the background; download one when it shows Succeeded.
      </p>

      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Input
            placeholder="Search file name…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pr-9"
          />
          {(search !== debouncedSearch || loading) && (
            <Loader2 className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Loading" />
          )}
        </div>
        <ViewFilterChips table={table} onClear={clearFilters} />
      </div>

      {error ? (
        <EmptyState
          tone="danger"
          title="Couldn't load exports"
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
        <EmptyState icon={FileDown} title="No exports yet" description="Use Export CSV on a list screen, such as Barcodes, and it will appear here." />
      ) : (
        <div
          aria-busy={loading}
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl ring-1 ring-border [&>[data-slot=table-container]]:min-h-0 [&>[data-slot=table-container]]:flex-1"
        >
          <Table className="table-fixed [&_td]:px-1.5 [&_th]:px-1.5">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {table.getHeaderGroups()[0].headers.map((header) => (
                  <TableHead key={header.id} style={{ width: `${header.column.columnDef.size}%` }} className="h-10 shadow-[inset_0_-1px_0_0_var(--border)]">
                    {header.column.columnDef.header && (
                      <ColumnHeader column={header.column} title={flexRender(header.column.columnDef.header, header.getContext())} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className={loading ? "pointer-events-none opacity-50 transition-opacity" : "transition-opacity"}>
              {rows.length === 0 && <TableEmptyRow colSpan={COLUMNS.length} />}
              {rows.map((job) => {
                const summary = job.title || exportParamsSummary(job.params);
                return (
                  <TableRow key={job.id}>
                    <TableCell className="truncate py-1 font-mono text-xs" title={job.filename || undefined}>
                      {job.filename || "Preparing…"}
                    </TableCell>
                    <TableCell className="truncate py-1 text-xs">{exportResourceLabel(job.resource)}</TableCell>
                    <TableCell className="truncate py-1 text-xs text-muted-foreground" title={summary || undefined}>
                      {summary || "No filters"}
                    </TableCell>
                    <TableCell className="py-1">
                      <StatusBadge tone={EXPORT_TONE[job.status] ?? "neutral"} className="status-chip--compact" title={job.error || undefined}>
                        {job.status}
                      </StatusBadge>
                      {job.status === "failed" && job.error && (
                        <p className="mt-0.5 truncate text-[0.7rem] text-destructive" title={job.error}>
                          {job.error}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="py-1 font-mono text-xs tabular-nums">{job.row_count == null ? "—" : job.row_count.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="truncate py-1 font-mono text-xs">{formatExportWhen(job.created_at)}</TableCell>
                    <TableCell className="py-1 font-mono text-xs tabular-nums">{exportDuration(job)}</TableCell>
                    <TableCell className="py-1 text-right">
                      {job.can_download && (
                        <Button size="xs" variant="outline" disabled={downloading} onClick={() => download(job)}>
                          Download
                        </Button>
                      )}
                    </TableCell>
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
