// ExportJob.status / resource values — apps.exports.
export const EXPORT_ACTIVE = ["queued", "running"];
export const EXPORT_TONE = { queued: "pending", running: "info", succeeded: "success", failed: "danger" };
export const EXPORT_STATUSES = [
  { value: "queued", label: "Queued" },
  { value: "running", label: "Running" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
];
export const EXPORT_RESOURCES = [
  { value: "barcodes", label: "Barcodes" },
  { value: "reports", label: "Reports" },
];
export const EXPORT_POLL_MS = 3000;

export const exportResourceLabel = (key) => EXPORT_RESOURCES.find((r) => r.value === key)?.label ?? key;

/** "status: in transit · search: dunk" — the filters an export was started with. */
export const exportParamsSummary = (params) =>
  Object.entries(params ?? {})
    .map(([key, value]) => `${key.replace(/_/g, " ")}: ${String(value).replace(/_/g, " ")}`)
    .join(" · ");

export const formatExportWhen = (value) =>
  value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

/** "42s", "3m 05s" — how long a finished export took. */
export function exportDuration(job) {
  if (!job.started_at || !job.finished_at) return "—";
  const seconds = Math.max(0, Math.round((new Date(job.finished_at) - new Date(job.started_at)) / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}
