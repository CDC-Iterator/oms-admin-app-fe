import { StatusBadge } from "@/components/status-badge.jsx";
import { shipmentTone } from "../lib/status.js";

// Shipment.Courier choices — apps.fulfilment.models.
const COURIER_LABEL = {
  manual: "Manual",
  shipway: "Shipway",
  shipdelight: "Shipdelight",
  quicklee: "Quicklee",
};

// Shared by the Orders list's expanded Lines row and Order Detail's Lines
// card — which 3PL a line item shipped with, once a shipment covers it.
export function FulfilledByBadge({ lineItem }) {
  if (lineItem.is_dropship) {
    return <StatusBadge tone="pending">Shipturtle</StatusBadge>;
  }

  const shipments = lineItem.shipments ?? [];
  if (shipments.length === 0) {
    return <StatusBadge tone="neutral">CDC</StatusBadge>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {shipments.map((s) => (
        <StatusBadge key={s.id} tone={shipmentTone(s.status)}>
          {s.carrier_name || COURIER_LABEL[s.courier] || s.courier}
        </StatusBadge>
      ))}
    </div>
  );
}
