import { TriangleAlert } from "lucide-react";

import { StatusBadge } from "@/components/status-badge.jsx";

const STATE = {
  reserved: { tone: "success", label: "Reserved" },
  suggested: { tone: "pending", label: "Suggested" },
  open: { tone: "neutral", label: "No unit yet" },
};

// A bundle line is several physical items: each part with its own state, barcode and warehouse, and a warning
// when the parts sit in different warehouses (one parcel can't ship from two).
export function BundleParts({ line }) {
  const parts = line.bundle_parts ?? [];
  const split = line.bundle_split ?? [];
  if (parts.length === 0) return null;
  return (
    <div className="mt-1 w-full space-y-1">
      {parts.map((p) => {
        const state = STATE[p.status] ?? STATE.open;
        return (
          <div key={p.item_code} className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-mono text-muted-foreground">{p.item_code}</span>
            {p.title && <span className="max-w-60 truncate" title={p.title}>{p.title}</span>}
            {p.count > 1 && <span className="text-muted-foreground">× {p.count}</span>}
            <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
            {p.barcode && (
              <span className="font-mono text-muted-foreground">
                {p.barcode} @ {p.location}
              </span>
            )}
          </div>
        );
      })}
      {split.length > 0 && (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-100/70 px-2 py-1 text-xs text-amber-900">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Parts are in {split.length} warehouses ({split.join(" + ")}). One parcel can&apos;t ship from two — move stock to one place,
            or book the parts separately.
          </span>
        </p>
      )}
    </div>
  );
}
