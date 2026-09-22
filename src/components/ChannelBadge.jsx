import { StatusBadge } from "./status-badge.jsx";

// StoreChannel.Name choices — apps.channels.models.
const LABELS = {
  shopify: "Shopify",
  tatacliq: "TataCliq",
  pos: "POS",
};

// Fixed per-channel tones (not tied to connection health) so the same channel
// always reads the same color everywhere it appears.
const TONES = {
  shopify: "success",
  tatacliq: "info",
  pos: "neutral",
};

/** The channel a given row/order came from — one consistent chip. */
export function ChannelBadge({ channel }) {
  if (!channel) return <span className="text-muted-foreground">—</span>;
  return <StatusBadge tone={TONES[channel] ?? "neutral"}>{LABELS[channel] ?? channel}</StatusBadge>;
}
