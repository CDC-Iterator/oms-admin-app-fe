import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { StatusBadge } from "@/components/status-badge.jsx";
import { shipmentTone } from "../lib/status.js";

const when = (value) =>
  value ? new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : null;

function Row({ label, children }) {
  return (
    <>
      <dt className="text-[11px] text-muted-foreground uppercase">{label}</dt>
      <dd className="min-w-0 break-words">{children || "\u2014"}</dd>
    </>
  );
}

function Tracking({ awb, url }) {
  if (!awb) return null;
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="font-mono underline">
      {awb}
    </a>
  ) : (
    <span className="font-mono">{awb}</span>
  );
}

// Where the order goes and how: the delivery address, the method, the warehouse, and every package booked or fulfilled.
export function ShippingDetailsCard({ order, shipments }) {
  const a = order.shipping_address ?? {};
  const cityLine = [a.city, a.province, a.zip].filter(Boolean).join(", ");
  const packages = [
    ...(shipments ?? [])
      .filter((s) => s.status !== "cancelled")
      .map((s) => ({
        key: `oms-${s.id}`,
        carrier: s.carrier_name || s.courier,
        awb: s.awb_number,
        url: s.tracking_url,
        status: s.status === "created" ? (s.dispatched_at ? "dispatched" : s.has_label ? "packed" : "booked") : s.status,
        note: s.dispatched_at ? `Handed over ${when(s.dispatched_at)}` : `Booked ${when(s.created_at)}`,
      })),
    ...(order.channel_fulfillments ?? []).map((f) => ({
      key: `ch-${f.id}`,
      carrier: f.carrier,
      awb: f.tracking_number,
      url: f.tracking_url,
      status: f.shipment_status || "fulfilled",
      note: `Fulfilled in Shopify ${when(f.created_at)}${f.location_name ? ` from ${f.location_name}` : ""}`,
    })),
  ];
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Shipping details</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-xs">
          <Row label="Ship to">{a.name}</Row>
          <Row label="Address">
            {[a.company, a.address1, a.address2, cityLine, a.country].filter(Boolean).map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </Row>
          <Row label="Phone">{a.phone}</Row>
          <Row label="Method">{order.delivery_method}</Row>
          <Row label="Ships from">{order.allocated_location}</Row>
        </dl>
        {packages.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            {packages.map((p) => (
              <div key={p.key} className="space-y-0.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="capitalize">{p.carrier || "Other"}</span>
                  <StatusBadge tone={shipmentTone(p.status)}>{String(p.status).replace(/_/g, " ")}</StatusBadge>
                </div>
                <Tracking awb={p.awb} url={p.url} />
                <p className="text-muted-foreground">{p.note}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
