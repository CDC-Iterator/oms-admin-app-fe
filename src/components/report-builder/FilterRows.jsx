import { ListFilter, X } from "lucide-react";

import { Button } from "@/components/ui/button.jsx";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Select } from "@/components/ui/select.jsx";
import { NO_VALUE_OPS, OP_LABELS, groupBy } from "../../lib/reportBuilder.js";

const pair = (value) => (Array.isArray(value) ? value : ["", ""]);

function ChoiceValue({ field, value, onChange }) {
  const chosen = Array.isArray(value) ? value : [];
  const labels = field.choices.filter((c) => chosen.includes(c.value)).map((c) => c.label);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-8 w-full items-center justify-between gap-1 rounded-lg border border-input px-2.5 text-left text-sm">
        <span className="truncate">{labels.length ? labels.join(", ") : "Choose…"}</span>
        <ListFilter className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40">
        {field.choices.map((c) => (
          <DropdownMenuCheckboxItem
            key={c.value}
            checked={chosen.includes(c.value)}
            closeOnClick={false}
            onCheckedChange={(on) => onChange(on ? [...chosen, c.value] : chosen.filter((v) => v !== c.value))}
          >
            {c.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ValueInput({ field, op, value, onChange }) {
  if (NO_VALUE_OPS.includes(op)) return null;
  if (field.type === "choice") return <ChoiceValue field={field} value={value} onChange={onChange} />;
  const inputType = field.type === "datetime" ? "date" : field.type === "number" || field.type === "money" ? "number" : "text";
  if (op === "between") {
    const [low, high] = pair(value);
    return (
      <div className="flex items-center gap-1">
        <Input type={inputType} value={low ?? ""} onChange={(e) => onChange([e.target.value, high ?? ""])} aria-label="From" />
        <span className="text-xs text-muted-foreground">–</span>
        <Input type={inputType} value={high ?? ""} onChange={(e) => onChange([low ?? "", e.target.value])} aria-label="To" />
      </div>
    );
  }
  if (op === "in") {
    return (
      <Input
        placeholder="a, b, c"
        value={Array.isArray(value) ? value.join(", ") : value ?? ""}
        onChange={(e) => onChange(e.target.value.split(",").map((v) => v.trim()))}
      />
    );
  }
  return <Input type={inputType} step={field.type === "money" ? "0.01" : undefined} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
}

/** One row per filter: field, operator and a value input that fits the field's type. */
export default function FilterRows({ fields, filters, onChange }) {
  const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
  const groups = Object.entries(groupBy(fields, "group"));
  const update = (i, patch) => onChange(filters.map((f, n) => (n === i ? { ...f, ...patch } : f)));

  return (
    <div className="space-y-2">
      {filters.map((filter, i) => {
        const field = byKey[filter.field];
        return (
          <div key={i} className="space-y-1.5 rounded-lg border border-border p-2">
            <div className="flex items-center gap-1">
              <Select
                className="min-w-0 flex-1"
                value={filter.field}
                onChange={(e) => {
                  const next = byKey[e.target.value];
                  update(i, { field: next.key, op: next.ops[0], value: "" });
                }}
                aria-label="Filter field"
              >
                {groups.map(([group, rows]) => (
                  <optgroup key={group} label={group}>
                    {rows.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
              <button type="button" aria-label="Remove filter" onClick={() => onChange(filters.filter((_, n) => n !== i))} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="size-3.5" />
              </button>
            </div>
            {field && (
              <>
                <Select
                  className="w-full"
                  value={filter.op}
                  onChange={(e) => update(i, { op: e.target.value, value: e.target.value === "between" ? ["", ""] : "" })}
                  aria-label="Filter operator"
                >
                  {field.ops.map((op) => (
                    <option key={op} value={op}>
                      {OP_LABELS[op] ?? op}
                    </option>
                  ))}
                </Select>
                <ValueInput field={field} op={filter.op} value={filter.value} onChange={(value) => update(i, { value })} />
              </>
            )}
          </div>
        );
      })}
      <Button
        size="xs"
        variant="outline"
        disabled={fields.length === 0}
        onClick={() => onChange([...filters, { field: fields[0].key, op: fields[0].ops[0], value: "" }])}
      >
        Add filter
      </Button>
    </div>
  );
}
