import { X } from "lucide-react";
import { useSearchParams } from "react-router-dom";

// Filters that arrive from a dashboard card or a saved view and have no column header; each chip clears one.
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

export default function ViewFilterChips({ keys = VIEW_ONLY_FILTERS }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = keys.filter((key) => searchParams.get(key));
  // A multi-status list (pending,confirmed) can't be shown by the single-choice column filter.
  const statusList = searchParams.get("status")?.includes(",") ? searchParams.get("status") : null;
  if (active.length === 0 && !statusList) return null;

  const clear = (key) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(key);
        next.delete("page");
        return next;
      },
      { replace: true }
    );

  const chip = (key, label) => (
    <span key={key} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
      {label}
      <button type="button" aria-label={`Remove ${label}`} className="rounded-full p-0.5 text-muted-foreground hover:text-foreground" onClick={() => clear(key)}>
        <X className="size-3" />
      </button>
    </span>
  );

  return (
    <div className="mb-3 flex shrink-0 flex-wrap items-center gap-1.5">
      {statusList && chip("status", `Status: ${statusList.split(",").join(", ")}`)}
      {active.map((key) => chip(key, LABELS[key](searchParams.get(key))))}
    </div>
  );
}
