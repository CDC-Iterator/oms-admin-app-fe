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

/** Order.status — apps.orders.models.Order.Status. */
export function orderTone(status) {
  switch ((status || "").toLowerCase()) {
    case "completed":
      return "success";
    case "pending":
      return "pending";
    case "confirmed":
      return "info";
    case "cancelled":
    case "returned":
    case "rto":
      return "danger";
    default:
      return "neutral";
  }
}

/** Order.payment_status — Shopify's financial_status, e.g. "paid". */
export function paymentTone(status) {
  switch ((status || "").toLowerCase()) {
    case "paid":
      return "success";
    case "partially_paid":
    case "pending":
      return "pending";
    case "refunded":
    case "partially_refunded":
    case "voided":
      return "danger";
    default:
      return "neutral";
  }
}

/** Order.fulfillment_status — Shopify's fulfillment_status, null = "unfulfilled". */
export function fulfillmentTone(status) {
  switch ((status || "").toLowerCase()) {
    case "fulfilled":
      return "success";
    case "partial":
      return "pending";
    case "restocked":
      return "danger";
    default:
      return "neutral";
  }
}

/** Shipment.status — apps.fulfilment.models. */
export function shipmentTone(status) {
  switch ((status || "").toLowerCase()) {
    case "delivered":
      return "success";
    case "created":
    case "in_transit":
      return "pending";
    case "rto":
    case "cancelled":
      return "danger";
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

// InventoryUnit.Status choices — apps.inventory.models.
export function unitStatusTone(status) {
  switch (status) {
    case "in_stock":
      return "success";
    case "reserved":
      return "pending";
    case "sold":
      return "info";
    case "damaged":
      return "danger";
    default:
      return "neutral";
  }
}

const UNIT_STATUS_LABELS = {
  in_stock: "In stock",
  in_transit: "In transit",
  reserved: "Reserved",
  sold: "Sold",
  returned: "Returned",
  damaged: "Damaged",
};

// POS never changes a unit's status when it runs out; qty 0 is the real signal.
export function unitStatus(unit) {
  if (unit.qty === 0 && unit.status === "in_stock") return { label: "Out of stock", tone: "neutral" };
  return { label: UNIT_STATUS_LABELS[unit.status] ?? unit.status, tone: unitStatusTone(unit.status) };
}
