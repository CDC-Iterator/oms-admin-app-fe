import { ArrowDown, ArrowUp, ArrowUpDown, ListFilter } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.jsx";

const ALL = "__all__";

// Header cell for a TanStack column: click to sort, and (when the column
// defines `meta.filterOptions`) a menu to filter. Both are server-side.
export function ColumnHeader({ column, title, align = "left" }) {
  const sortable = column.getCanSort();
  const options = column.columnDef.meta?.filterOptions;
  const sorted = column.getIsSorted();
  const filter = column.getFilterValue() ?? "";
  const SortIcon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <div className={cn("flex items-center gap-0.5", align === "right" && "justify-end", align === "center" && "justify-center")}>
      {sortable ? (
        <button
          type="button"
          onClick={column.getToggleSortingHandler()}
          className="inline-flex items-center gap-1 rounded hover:text-foreground"
          aria-label={`Sort by ${title}`}
        >
          {title}
          <SortIcon className={cn("size-3", sorted ? "text-foreground" : "text-muted-foreground/50")} />
        </button>
      ) : (
        title
      )}
      {options && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded p-0.5 hover:bg-muted"
            aria-label={`Filter ${title}`}
          >
            <ListFilter className={cn("size-3", filter ? "text-primary" : "text-muted-foreground/50")} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-36">
            <DropdownMenuRadioGroup
              value={filter || ALL}
              onValueChange={(value) => column.setFilterValue(value === ALL ? undefined : value)}
            >
              <DropdownMenuRadioItem value={ALL}>All</DropdownMenuRadioItem>
              <DropdownMenuSeparator />
              {options.map((o) => (
                <DropdownMenuRadioItem key={o.value} value={o.value}>
                  {o.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
