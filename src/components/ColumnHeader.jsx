import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarRange, ListFilter } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button.jsx";
import { DATE_PRESETS, dateRangeLabel, parseCustomRange } from "../lib/dateRange.js";
import { QTY_PRESETS, buildQtyRange, parseQtyRange, qtyRangeLabel } from "../lib/qtyRange.js";
import { Textarea } from "@/components/ui/textarea.jsx";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
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
            <p className="mb-1.5 text-xs font-medium">{title}s — paste {column.columnDef.meta?.filterNoun ?? "ids"}, comma or line separated</p>
            <Textarea
              autoFocus
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={column.columnDef.meta?.filterPlaceholder ?? "#CDC163482, #CDC162263…"}
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

// Date column filter: preset ranges, or a custom From/To (either may be left open).
function DateRangeFilter({ column, title }) {
  const value = column.getFilterValue() ?? "";
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const invalid = from && to && from > to;

  const apply = (next) => {
    column.setFilterValue(next || undefined);
    setOpen(false);
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          const custom = parseCustomRange(value);
          setFrom(custom.from);
          setTo(custom.to);
        }
      }}
    >
      <Popover.Trigger className="rounded p-0.5 hover:bg-muted" aria-label={`Filter ${title} by date range`} title={value ? dateRangeLabel(value) : undefined}>
        <CalendarRange className={cn("size-3", value ? "text-primary" : "text-muted-foreground/50")} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="start" sideOffset={6} className="z-50">
          <Popover.Popup className="w-64 rounded-lg bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10">
            <div className="space-y-0.5">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => apply(p.value)}
                  className={cn(
                    "flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                    value === p.value && "bg-muted font-medium"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="mt-2 space-y-2 border-t border-border px-2 pt-2.5">
              <p className="text-xs font-medium text-muted-foreground">Custom range</p>
              <label className="flex items-center justify-between gap-2 text-sm">
                From
                <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-input bg-transparent px-2 py-1 text-sm" />
              </label>
              <label className="flex items-center justify-between gap-2 text-sm">
                To
                <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-input bg-transparent px-2 py-1 text-sm" />
              </label>
              {invalid && <p className="text-xs text-destructive">The end date is before the start date.</p>}
              <div className="flex items-center justify-between pb-1">
                <Button size="xs" variant="ghost" onClick={() => apply(undefined)}>
                  Clear
                </Button>
                <Button size="xs" disabled={(!from && !to) || invalid} onClick={() => apply(`${from}..${to}`)}>
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

// Quantity filter: presets, or a custom Min/Max (either may be left open) — stored as ?qty=1.. / 0 / 2..9.
function QtyRangeFilter({ column, title }) {
  const value = column.getFilterValue() ?? "";
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const invalid = min !== "" && max !== "" && Number(min) > Number(max);

  const apply = (next) => {
    column.setFilterValue(next || undefined);
    setOpen(false);
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          const current = parseQtyRange(value);
          setMin(current.min);
          setMax(current.max);
        }
      }}
    >
      <Popover.Trigger className="rounded p-0.5 hover:bg-muted" aria-label={`Filter ${title}`} title={value ? qtyRangeLabel(value) : undefined}>
        <ListFilter className={cn("size-3", value ? "text-primary" : "text-muted-foreground/50")} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="start" sideOffset={6} className="z-50">
          <Popover.Popup className="w-60 rounded-lg bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10">
            <div className="space-y-0.5">
              {QTY_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => apply(p.value)}
                  className={cn("flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted", value === p.value && "bg-muted font-medium")}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="mt-2 space-y-2 border-t border-border px-2 pt-2.5">
              <p className="text-xs font-medium text-muted-foreground">Custom range</p>
              <label className="flex items-center justify-between gap-2 text-sm">
                Min
                <input type="number" min={0} value={min} onChange={(e) => setMin(e.target.value)} className="w-24 rounded-md border border-input bg-transparent px-2 py-1 text-sm" />
              </label>
              <label className="flex items-center justify-between gap-2 text-sm">
                Max
                <input type="number" min={0} value={max} onChange={(e) => setMax(e.target.value)} className="w-24 rounded-md border border-input bg-transparent px-2 py-1 text-sm" />
              </label>
              {invalid && <p className="text-xs text-destructive">Max is below min.</p>}
              <div className="flex items-center justify-between pb-1">
                <Button size="xs" variant="ghost" onClick={() => apply(undefined)}>
                  Clear
                </Button>
                <Button size="xs" disabled={(min === "" && max === "") || invalid} onClick={() => apply(buildQtyRange(min, max))}>
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
  const isDateRange = column.columnDef.meta?.filterDateRange;
  const isQtyRange = column.columnDef.meta?.filterIntRange;
  const isMulti = column.columnDef.meta?.filterMulti;
  const sorted = column.getIsSorted();
  const filter = column.getFilterValue() ?? "";
  const selected = String(filter).split(",").filter(Boolean);
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
      {isDateRange && <DateRangeFilter column={column} title={title} />}
      {isQtyRange && <QtyRangeFilter column={column} title={title} />}
      {options && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded p-0.5 hover:bg-muted"
            aria-label={`Filter ${title}`}
          >
            <ListFilter className={cn("size-3", filter ? "text-primary" : "text-muted-foreground/50")} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-36">
            {isMulti ? (
              <>
                <DropdownMenuCheckboxItem checked={selected.length === 0} closeOnClick={false} onCheckedChange={() => column.setFilterValue(undefined)}>
                  All
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {options.map((o) => (
                  <DropdownMenuCheckboxItem
                    key={o.value}
                    checked={selected.includes(String(o.value))}
                    closeOnClick={false}
                    onCheckedChange={(on) => {
                      const next = on ? [...selected, String(o.value)] : selected.filter((v) => v !== String(o.value));
                      column.setFilterValue(next.length ? next.join(",") : undefined);
                    }}
                  >
                    {o.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </>
            ) : (
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
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
