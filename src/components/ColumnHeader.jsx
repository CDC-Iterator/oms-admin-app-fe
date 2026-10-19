import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { ArrowDown, ArrowUp, ArrowUpDown, ListFilter } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button.jsx";
import { Textarea } from "@/components/ui/textarea.jsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.jsx";

const ALL = "__all__";
const MAX_IDS = 500;

// Ids pasted comma/space/newline separated -> one de-duplicated, comma-joined filter value.
const parseIds = (text) => [...new Set(text.split(/[\s,;]+/).filter(Boolean))].slice(0, MAX_IDS);

// Filter that takes a pasted list (e.g. order ids) in a textarea, applied with the button.
function IdListFilter({ column, title }) {
  const value = column.getFilterValue() ?? "";
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const ids = parseIds(text);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setText(value.split(",").join("\n"));
      }}
    >
      <Popover.Trigger className="rounded p-0.5 hover:bg-muted" aria-label={`Filter ${title}`}>
        <ListFilter className={cn("size-3", value ? "text-primary" : "text-muted-foreground/50")} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="start" sideOffset={6} className="z-50">
          <Popover.Popup className="w-72 rounded-lg bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10">
            <p className="mb-1.5 text-xs font-medium">{title}s — paste ids, comma or line separated</p>
            <Textarea
              autoFocus
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="#CDC163482, #CDC162263…"
              className="min-h-24 font-mono text-xs"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                {ids.length} id{ids.length === 1 ? "" : "s"}
                {ids.length >= MAX_IDS ? ` (max ${MAX_IDS})` : ""}
              </span>
              <div className="flex gap-1.5">
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    column.setFilterValue(undefined);
                    setOpen(false);
                  }}
                >
                  Clear
                </Button>
                <Button
                  size="xs"
                  onClick={() => {
                    column.setFilterValue(ids.length ? ids.join(",") : undefined);
                    setOpen(false);
                  }}
                >
                  Apply
                </Button>
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

// Header cell for a TanStack column: click to sort, and (when the column
// defines `meta.filterOptions`) a menu to filter. Both are server-side.
export function ColumnHeader({ column, title, align = "left" }) {
  const sortable = column.getCanSort();
  const options = column.columnDef.meta?.filterOptions;
  const isIdList = column.columnDef.meta?.filterIds;
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
      {isIdList && <IdListFilter column={column} title={title} />}
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
