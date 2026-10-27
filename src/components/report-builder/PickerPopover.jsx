import { useMemo, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { groupBy } from "../../lib/reportBuilder.js";

/**
 * "+" button that opens a searchable, grouped checklist (like Shopify's metric picker).
 * `items` are `{ key, label, group }`; `selected` the chosen keys; Apply sends the new list to `onApply`.
 */
export default function PickerPopover({ title, items, selected, onApply, single = false, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(selected);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const shown = needle ? items.filter((i) => i.label.toLowerCase().includes(needle) || i.group.toLowerCase().includes(needle)) : items;
    return Object.entries(groupBy(shown, "group"));
  }, [items, query]);

  const toggle = (key) =>
    setDraft((prev) => (single ? [key] : prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDraft(selected);
          setQuery("");
        }
      }}
    >
      <Popover.Trigger
        disabled={disabled}
        aria-label={`Add ${title}`}
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
      >
        <Plus className="size-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="end" sideOffset={6} className="z-50">
          <Popover.Popup className="flex max-h-[28rem] w-80 max-w-[calc(100vw-2rem)] flex-col rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10">
            <div className="relative p-2">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus placeholder={`Search ${title.toLowerCase()}…`} value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
              {groups.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nothing matches.</p>}
              {groups.map(([group, rows]) => (
                <section key={group} className="mb-2">
                  <h4 className="px-2 py-1 text-xs font-medium text-muted-foreground">{group}</h4>
                  {rows.map((item) => (
                    <label key={item.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                      <input
                        type={single ? "radio" : "checkbox"}
                        className="oms-checkbox"
                        checked={draft.includes(item.key)}
                        onChange={() => toggle(item.key)}
                      />
                      <span className="min-w-0 flex-1 truncate" title={item.label}>
                        {item.label}
                      </span>
                    </label>
                  ))}
                </section>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-border p-2">
              <Button size="xs" variant="ghost" onClick={() => setDraft([])}>
                Clear
              </Button>
              <Button
                size="xs"
                onClick={() => {
                  onApply(draft);
                  setOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
