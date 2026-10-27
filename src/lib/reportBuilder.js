// Report builder: helpers around the catalog (apps.report_builder) and a report's config.
export const OP_LABELS = {
  is: "is",
  is_not: "is not",
  contains: "contains",
  not_contains: "doesn't contain",
  in: "is one of",
  not_in: "is not one of",
  empty: "is empty",
  not_empty: "is not empty",
  eq: "=",
  ne: "≠",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  between: "between",
  on: "on",
  before: "before",
  after: "after",
  is_true: "is yes",
  is_false: "is no",
};
export const NO_VALUE_OPS = ["empty", "not_empty", "is_true", "is_false"];
export const BUCKET_LABELS = { day: "Day", week: "Week", month: "Month", year: "Year" };

export const emptyConfig = (resource) => ({
  mode: "records",
  columns: [...(resource?.default_columns ?? [])],
  dimensions: [],
  metrics: [],
  filters: [],
  date_range: "",
  ordering: [],
});

/** The config as the API wants it: only what the current mode uses, and no half-filled filters. */
export function cleanConfig(config) {
  const filters = (config.filters ?? []).filter((f) => f.field && f.op && (NO_VALUE_OPS.includes(f.op) || hasValue(f.value)));
  const base = { mode: config.mode, filters, date_range: config.date_range || "", ordering: config.ordering ?? [] };
  return config.mode === "summary"
    ? { ...base, dimensions: config.dimensions ?? [], metrics: config.metrics ?? [] }
    : { ...base, columns: config.columns ?? [] };
}

export function hasValue(value) {
  if (Array.isArray(value)) return value.some((v) => v !== "" && v != null);
  return value !== "" && value != null;
}

/** True when a config has something to show: columns (records) or a metric (summary). */
export const isRunnable = (config) => (config.mode === "summary" ? (config.metrics ?? []).length > 0 : (config.columns ?? []).length > 0);

export const groupBy = (items, key) =>
  items.reduce((groups, item) => {
    (groups[item[key]] ??= []).push(item);
    return groups;
  }, {});

export const formatCell = (value, type) => {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "money") return Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (type === "number") return Number(value).toLocaleString("en-IN");
  return String(value);
};
