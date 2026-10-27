import { useEffect, useState } from "react";
import { FileBarChart, Loader2, Plus } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { EmptyState } from "../components/empty-state.jsx";
import Pagination from "../components/Pagination.jsx";
import { Button, buttonVariants } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Select } from "@/components/ui/select.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { useGetReportCatalogQuery, useGetReportDefsQuery } from "../api/services/reportBuilder.js";
import { useAuth } from "../hooks/useAuth.js";
import { formatApiError } from "../lib/errors.js";

const PAGE_SIZE = 50;

function useDebounced(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

export default function ReportBuilderList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page")) || 1;
  const resource = searchParams.get("resource") || "";
  const mine = searchParams.get("mine") === "1";
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search, 300);

  const update = (patch) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries({ page: null, ...patch })) {
          if (value === null || value === "" || value === undefined) next.delete(key);
          else next.set(key, String(value));
        }
        return next;
      },
      { replace: true }
    );

  const { data: catalog } = useGetReportCatalogQuery();
  const { data, isFetching, error, refetch } = useGetReportDefsQuery({
    page,
    page_size: PAGE_SIZE,
    resource: resource || undefined,
    mine: mine ? "1" : undefined,
    search: debounced || undefined,
  });
  const rows = data?.rows ?? [];
  const filtered = Boolean(resource || mine || debounced);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-muted-foreground">Build reports from orders, products, inventory, customers and shipments, then save and export them.</p>
        <Link to="/reports/new" className={buttonVariants()}>
          <Plus className="size-4" />
          New report
        </Link>
      </div>

      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Input placeholder="Search reports…" value={search} onChange={(e) => (setSearch(e.target.value), update({}))} className="w-full pr-9" />
          {(search !== debounced || isFetching) && (
            <Loader2 className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Loading" />
          )}
        </div>
        <Select value={resource} onChange={(e) => update({ resource: e.target.value })} aria-label="Category">
          <option value="">All categories</option>
          {(catalog?.resources ?? []).map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </Select>
        <Select value={mine ? "1" : ""} onChange={(e) => update({ mine: e.target.value })} aria-label="Created by">
          <option value="">Created by anyone</option>
          <option value="1">Created by me</option>
        </Select>
      </div>

      {error ? (
        <EmptyState
          tone="danger"
          title="Couldn't load reports"
          description={`${formatApiError(error)} — try again.`}
          action={
            <Button size="sm" variant="outline" onClick={refetch}>
              Try again
            </Button>
          }
        />
      ) : isFetching && !data ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 && !filtered ? (
        <EmptyState
          icon={FileBarChart}
          title="No reports yet"
          description="Create one to pick columns, add filters or summarise metrics, and export it as CSV."
          action={
            <Link to="/reports/new" className={buttonVariants({ size: "sm" })}>
              New report
            </Link>
          }
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl ring-1 ring-border [&>[data-slot=table-container]]:h-full">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[44%]">Name</TableHead>
                <TableHead className="w-[16%]">Category</TableHead>
                <TableHead className="w-[16%]">Last viewed</TableHead>
                <TableHead className="w-[24%]">Created by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    No reports match these filters.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((report) => (
                <TableRow key={report.id} className="cursor-pointer" onClick={() => navigate(`/reports/${report.id}`)}>
                  <TableCell className="truncate font-medium" title={report.name}>
                    {report.name}
                    {report.is_shared && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-normal text-muted-foreground">Shared</span>}
                  </TableCell>
                  <TableCell>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{report.resource_label}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(report.last_viewed_at)}</TableCell>
                  <TableCell className="truncate text-sm" title={report.owner}>
                    {report.owner === user?.email ? "You" : report.owner}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="shrink-0">
        <Pagination page={page} pageSize={PAGE_SIZE} count={data?.count ?? 0} onPageChange={(p) => update({ page: p <= 1 ? null : p })} loading={isFetching} />
      </div>
    </div>
  );
}
