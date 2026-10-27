import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { cn } from "@/lib/utils";
import { formatCell } from "../../lib/reportBuilder.js";

const isNumeric = (col) => col.type === "number" || col.type === "money";

/** Preview rows, with a totals row for summary reports. */
export default function ResultTable({ result, loading }) {
  const { columns, rows, totals } = result;
  return (
    <div aria-busy={loading} className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl ring-1 ring-border [&>[data-slot=table-container]]:min-h-0 [&>[data-slot=table-container]]:flex-1">
      {loading && (
        <div className="absolute inset-x-0 top-0 z-20 h-[3px] overflow-hidden bg-primary/15">
          <div className="animate-indeterminate h-full w-1/3 bg-primary" />
        </div>
      )}
      <Table className="table-scroll [&_td]:px-2 [&_th]:px-2">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => (
              <TableHead key={col.key + col.label} className={cn("h-10 shadow-[inset_0_-1px_0_0_var(--border)]", isNumeric(col) && "text-right")}>
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {totals && (
            <TableRow className="bg-muted/50 font-medium hover:bg-muted/50">
              {columns.map((col, i) => (
                <TableCell key={col.key + col.label} className={cn("py-1.5 text-xs", isNumeric(col) && "text-right font-mono tabular-nums")}>
                  {i === 0 ? "Total" : formatCell(totals[i], col.type)}
                </TableCell>
              ))}
            </TableRow>
          )}
          {rows.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="py-10 text-center text-sm text-muted-foreground">
                No rows match this report.
              </TableCell>
            </TableRow>
          )}
          {rows.map((row, r) => (
            <TableRow key={r}>
              {columns.map((col, i) => (
                <TableCell key={col.key + col.label} className={cn("py-1 text-xs", isNumeric(col) && "text-right font-mono tabular-nums", col.kind === "dimension" && "font-medium")}>
                  {formatCell(row[i], col.type)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
