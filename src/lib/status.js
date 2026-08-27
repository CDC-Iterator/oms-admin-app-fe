/**
 * Maps raw Shopify status strings (as stored verbatim by the webhook
 * handlers — see backend/shopify/handlers/webhook.py) to a display tone.
 * Never fabricates a label: unknown/blank values fall back to "neutral"
 * and the caller decides whether to render a chip or a plain dash.
 */

export function paymentTone(status) {
  switch ((status || "").toLowerCase()) {
    case "paid":
      return "success";
    case "authorized":
    case "partially_paid":
    case "pending":
      return "pending";
    case "partially_refunded":
    case "refunded":
      return "neutral";
    case "voided":
    case "expired":
      return "danger";
    default:
      return "neutral";
  }
}

export function orderFulfillmentTone(status) {
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

export function fulfillmentRecordTone(status) {
  switch ((status || "").toLowerCase()) {
    case "success":
      return "success";
    case "pending":
    case "open":
      return "pending";
    case "cancelled":
    case "error":
    case "failure":
      return "danger";
    default:
      return "neutral";
  }
}

/** Inventory has no status field from Shopify — derive one from quantity. */
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

/** Reservation state on an OMS order (see mockDb.sellUnit/reverseOrder). */
export function reservationTone(status) {
  switch ((status || "").toLowerCase()) {
    case "reserved":
      return "success";
    case "cancelled":
      return "danger";
    case "restocked":
      return "neutral";
    case "pending":
      return "pending";
    default:
      return "neutral";
  }
}

/** Channel connection health (Channels screen, order/mapping channel chips). */
export function channelTone(status) {
  switch ((status || "").toLowerCase()) {
    case "connected":
      return "success";
    case "degraded":
      return "pending";
    case "disconnected":
      return "danger";
    default:
      return "neutral";
  }
}

/** Sync/activity log entry outcome. */
export function syncTone(status) {
  switch ((status || "").toLowerCase()) {
    case "ok":
      return "success";
    case "retry":
      return "pending";
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}

/** SKU/ID mapping coverage — used on the Channels + Mappings screens. */
export function mappingTone(mapped) {
  return mapped ? "success" : "pending";
}
