import { TableCell, TableRow } from "@/components/ui/table.jsx";

// Shown inside the table (header kept) when a column filter leaves no rows, so the filter stays reachable.
export function TableEmptyRow({ colSpan, children = "No rows match these filters." }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  );
}
