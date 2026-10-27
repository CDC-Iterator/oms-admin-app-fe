// Date-range filter values for ?placed= — a preset key, or a custom "YYYY-MM-DD..YYYY-MM-DD" (either end optional).
export const DATE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
];

const short = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** "Last 7 days", "1 Oct 2026 – 27 Oct 2026", "from 1 Oct 2026", "until 15 Oct 2026". */
export function dateRangeLabel(value) {
  const preset = DATE_PRESETS.find((p) => p.value === value);
  if (preset) return preset.label;
  const [from = "", to = ""] = String(value).split("..");
  if (from && to) return `${short(from)} – ${short(to)}`;
  if (from) return `from ${short(from)}`;
  if (to) return `until ${short(to)}`;
  return String(value);
}

export const parseCustomRange = (value) => {
  if (!value || !String(value).includes("..")) return { from: "", to: "" };
  const [from = "", to = ""] = String(value).split("..");
  return { from, to };
};
