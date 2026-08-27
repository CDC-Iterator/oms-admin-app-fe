import { FlaskConical } from "lucide-react";

/**
 * Flags a screen as proposed extra scope — currently only the allocation
 * rules builder + preview (serial-level allocation is not in the current
 * ₹3.5L OMS proposal, which leaves allocation/reservation owned by POS 2.0).
 * Keep this visible rather than quietly shipping scope creep as if it were
 * always part of the build.
 */
export function ScopeBanner({ children }) {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-dashed border-[color-mix(in_srgb,var(--status-pending)_45%,var(--border))] bg-[color-mix(in_srgb,var(--status-pending)_8%,var(--card))] px-3.5 py-2.5 text-sm">
      <FlaskConical
        className="mt-0.5 size-4 shrink-0 text-[color-mix(in_srgb,var(--status-pending)_70%,black)]"
        strokeWidth={2}
      />
      <div className="space-y-0.5">
        <p className="font-heading text-xs font-semibold tracking-wide text-[color-mix(in_srgb,var(--status-pending)_70%,black)] uppercase">
          Proposed — extra scope
        </p>
        <p className="text-muted-foreground">
          {children ??
            "Not in the current OMS proposal. Allocation and reservation stay owned by POS 2.0 in Phase 1 — this is a preview of what adding it would look like."}
        </p>
      </div>
    </div>
  );
}
