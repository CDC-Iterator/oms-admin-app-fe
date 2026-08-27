import { StatusBadge } from "./status-badge.jsx";

const LABELS = {
  shopify: "Shopify",
};

// Fixed per-channel tones (not tied to connection health) so the same channel
// always reads the same color across Orders, Mappings, and Activity.
const TONES = {
  shopify: "success",
};

/** The channel a given row/order/mapping came from — one consistent chip. */
export function ChannelBadge({ channel }) {
  if (!channel) return <span className="text-muted-foreground">—</span>;
  return <StatusBadge tone={TONES[channel] ?? "neutral"}>{LABELS[channel] ?? channel}</StatusBadge>;
}
