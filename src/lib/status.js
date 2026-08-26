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
