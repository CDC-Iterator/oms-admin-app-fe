import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { CalendarRange } from "lucide-react";

import { Button } from "@/components/ui/button.jsx";
import { cn } from "@/lib/utils";
import { DATE_PRESETS, dateRangeLabel, parseCustomRange } from "../../lib/dateRange.js";

/** The report's date range: a preset, a custom From/To (either may be left open), or all time. */
export default function DateRangeSelect({ value, onChange, fieldLabel }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const invalid = from && to && from > to;
  const apply = (next) => {
    onChange(next || "");
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
      <Popover.Trigger render={<Button variant="outline" />} title={fieldLabel ? `Filters on ${fieldLabel}` : undefined}>
        <CalendarRange className="size-3.5" />
        {value ? dateRangeLabel(value) : "All time"}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="start" sideOffset={6} className="z-50">
          <Popover.Popup className="w-64 rounded-lg bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10">
            <div className="space-y-0.5">
              {[{ value: "", label: "All time" }, ...DATE_PRESETS].map((p) => (
                <button
                  key={p.value || "all"}
                  type="button"
                  onClick={() => apply(p.value)}
                  className={cn("flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted", value === p.value && "bg-muted font-medium")}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="mt-2 space-y-2 border-t border-border px-2 pt-2.5">
              <p className="text-xs font-medium text-muted-foreground">Custom range{fieldLabel ? ` · ${fieldLabel}` : ""}</p>
              <label className="flex items-center justify-between gap-2 text-sm">
                From
                <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-input bg-transparent px-2 py-1 text-sm" />
              </label>
              <label className="flex items-center justify-between gap-2 text-sm">
                To
                <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-input bg-transparent px-2 py-1 text-sm" />
              </label>
              {invalid && <p className="text-xs text-destructive">The end date is before the start date.</p>}
              <div className="flex justify-end pb-1">
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
