/**
 * Maps a raw backend status string to a display tone. Never fabricates a
 * label: unknown/blank values fall back to "neutral" and the caller decides
 * whether to render a chip or a plain dash.
 */

/** InventoryLedger.available_qty has no status field — derive one from quantity. */
export function stockLevel(available) {
  if (available === null || available === undefined) {
    return { tone: "neutral", label: "Unknown" };
  }
  if (available <= 0) {
    return { tone: "danger", label: "Out of stock" };
  }
  if (available < 10) {
    return { tone: "pending", label: "Low stock" };
  }
  return { tone: "success", label: "In stock" };
}

// A suggestion is a non-binding candidate — once an order is cancelled/RTO'd
// (its reserved unit already released back to the ledger) or completed (the
// line item either has a confirmed unit or it doesn't), a leftover
// suggestion is no longer meaningful to show.
export const SUGGESTION_HIDDEN_STATUSES = new Set(["cancelled", "rto", "completed"]);

/** Order.status — apps.orders.models. */
export function reservationTone(status) {
  switch ((status || "").toLowerCase()) {
    case "confirmed":
    case "completed":
      return "success";
    case "cancelled":
    case "rto":
      return "danger";
    case "returned":
      return "neutral";
    case "pending":
      return "pending";
    default:
      return "neutral";
  }
}

/** SyncLog.status — apps.inventory.models. */
export function syncTone(status) {
  switch ((status || "").toLowerCase()) {
    case "success":
      return "success";
    case "retrying":
      return "pending";
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}
