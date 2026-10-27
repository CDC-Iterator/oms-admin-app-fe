import { X } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { dateRangeLabel } from "../lib/dateRange.js";
import { qtyRangeLabel } from "../lib/qtyRange.js";

// Filters that arrive from a dashboard card or a saved view and have no column header.
const LABELS = {
  created: (v) => (v === "today" ? "Created today" : `Created ${v}`),
  waiting_hours: (v) => `Waiting over ${v}h`,
  since_hours: (v) => `Last ${v}h`,
  profile: (v) => (v === "instant" ? "Instant orders" : `Profile: ${v}`),
  unit_status: (v) => (v === "none" ? "No unit available" : `Unit ${v}`),
  invoice: (v) => (v === "missing" ? "No POS invoice yet" : `Invoice ${v}`),
  dropship: (v) => (v === "true" ? "ShipTurtle (dropship)" : "Not dropship"),
  pos_eligible: () => "POS-processable",
  topic: (v) => `Topic: ${v}`,
};

export const VIEW_ONLY_FILTERS = Object.keys(LABELS);

const titleCase = (text) => text.charAt(0).toUpperCase() + text.slice(1).replace(/_/g, " ");

// One pill for the column filter, e.g. "Channel: Shopify", "Date: Last 7 days", "Order: 12 ids".
function columnPill(column, value) {
  const meta = column.columnDef.meta ?? {};
  const header = column.columnDef.header;
  const name = meta.label ?? (typeof header === "string" && header ? header : titleCase(column.id));
  let shown = String(value);
  if (meta.filterDateRange) shown = dateRangeLabel(value);
  else if (meta.filterIntRange) shown = qtyRangeLabel(value);
  else if (meta.filterIds) {
    const count = String(value).split(",").filter(Boolean).length;
    shown = `${count} id${count === 1 ? "" : "s"}`;
  } else if (meta.filterOptions) {
    // A link can carry several values (status=pending,confirmed); label each one.
    const labelFor = (v) => meta.filterOptions.find((o) => String(o.value) === v)?.label ?? v;
    shown = String(value).split(",").map(labelFor).join(", ");
  }
  return { key: `col:${column.id}`, label: `${name}: ${shown}`, clear: () => column.setFilterValue(undefined) };
}

/**
 * A pill for every applied filter — the table's column filters plus the dashboard/saved-view ones —
 * each with an ✕ to clear it. Sits above the saved-view tabs.
 */
export default function ViewFilterChips({ table, keys = [], className = "order-last w-full" }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const columnFilters = table ? table.getState().columnFilters : [];
  const pills = columnFilters
    .map((f) => ({ f, column: table.getColumn(f.id) }))
    .filter(({ column }) => column)
    .map(({ f, column }) => columnPill(column, f.value));

  // Param-based pills, skipping any param a column filter already covers.
  const covered = new Set(table ? table.getAllColumns().map((c) => c.columnDef.meta?.filterParam).filter(Boolean) : []);
  const clearParam = (key) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(key);
        next.delete("page");
        return next;
      },
      { replace: true }
    );
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value && !covered.has(key)) pills.push({ key, label: LABELS[key]?.(value) ?? `${titleCase(key)}: ${value}`, clear: () => clearParam(key) });
  }

  if (pills.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {pills.map((pill) => (
        <span key={pill.key} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
          {pill.label}
          <button type="button" aria-label={`Remove ${pill.label}`} className="rounded-full p-0.5 text-muted-foreground hover:text-foreground" onClick={pill.clear}>
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
