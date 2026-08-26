import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "./empty-state.jsx";

const SKELETON_ROWS = 6;

/**
 * Generic table for the listing screens. `columns` is
 * [{ key, label, mono?, render? }] — `mono: true` renders the cell in the
 * tabular monospace face (order/tracking/SKU ids, prices, dates); `render`
 * overrides the raw field lookup when a value needs formatting.
 *
 * `empty` is the caller's domain-specific EmptyState (icon + copy for that
 * screen). A load failure gets the same panel treatment, tinted for
 * failure, with a "Try again" action wired to `onRetry`.
 */
export default function DataTable({ columns, rows, loading, error, onRetry, empty }) {
  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        tone="danger"
        title="Couldn't load this list"
        description={`${error} — check that the backend is reachable, then try again.`}
        action={
          onRetry ? (
            <Button size="sm" variant="outline" onClick={onRetry}>
              Try again
            </Button>
          ) : null
        }
      />
    );
  }

  if (!loading && (!rows || rows.length === 0)) {
    return empty;
  }

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className="h-10 font-mono text-[0.6875rem] font-medium tracking-wider text-muted-foreground uppercase"
              >
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading
            ? Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : rows.map((row) => (
                <TableRow key={row.id}>
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(col.mono && "font-mono text-[13px] tabular-nums")}
                    >
                      {col.render ? col.render(row) : row[col.key] ?? "—"}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  );
}
