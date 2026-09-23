import { useLayoutEffect, useRef, useState } from "react";
import { Boxes, Store } from "lucide-react";

import { ChannelBadge } from "./ChannelBadge.jsx";
import { useGetLocationsQuery } from "../api/services/locations.js";

// Every CDC Location's available_qty is summed into one number before any
// push_inventory call (apps/inventory/tasks.py) — so this is always a full
// fan-in, every Location to every push-ready channel, never a subset.
const CHANNEL_NODES = [
  { name: "shopify", label: "Shopify", stroke: "var(--status-success)" },
  { name: "tatacliq", label: "TataCliq", stroke: "var(--status-info)" },
];

function locationIcon(type) {
  return type === "store" ? Store : Boxes;
}

/**
 * Visualizes which CDC Locations' stock feeds which channel's inventory
 * push — a many-to-one fan, not a picker. Draws real connector lines
 * (measured via getBoundingClientRect, not percentage guesses) from every
 * Location row to every push_ready channel node.
 */
export default function LocationChannelDiagram({ connections }) {
  const { data, isFetching } = useGetLocationsQuery();
  const locations = data?.rows ?? [];

  const containerRef = useRef(null);
  const locationRefs = useRef(new Map());
  const channelRefs = useRef(new Map());
  const [lines, setLines] = useState([]);

  useLayoutEffect(() => {
    function recalc() {
      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const next = [];
      for (const location of locations) {
        const sourceEl = locationRefs.current.get(location.id);
        if (!sourceEl) continue;
        const sourceRect = sourceEl.getBoundingClientRect();
        const x1 = sourceRect.right - containerRect.left;
        const y1 = sourceRect.top + sourceRect.height / 2 - containerRect.top;

        for (const channel of CHANNEL_NODES) {
          const connection = connections.find((c) => c.name === channel.name);
          if (!connection?.push_ready) continue;
          const targetEl = channelRefs.current.get(channel.name);
          if (!targetEl) continue;
          const targetRect = targetEl.getBoundingClientRect();
          const x2 = targetRect.left - containerRect.left;
          const y2 = targetRect.top + targetRect.height / 2 - containerRect.top;
          const midX = (x1 + x2) / 2;
          next.push({
            key: `${location.id}-${channel.name}`,
            d: `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`,
            stroke: channel.stroke,
          });
        }
      }
      setLines(next);
    }

    recalc();
    const observer = new ResizeObserver(recalc);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("resize", recalc);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recalc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, connections]);

  if (isFetching && locations.length === 0) return null;
  if (locations.length === 0) return null;

  return (
    <div className="mt-6 max-w-3xl">
      <h2 className="mb-1 text-sm font-medium">Inventory push mapping</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Every location's available stock is summed together before each push — a location can (and here, every
        location does) feed more than one channel at once.
      </p>
      <div ref={containerRef} className="relative flex justify-between gap-8 rounded-xl border border-border p-4">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          {lines.map((line) => (
            <path key={line.key} d={line.d} fill="none" stroke={line.stroke} strokeWidth="1.5" strokeOpacity="0.5" />
          ))}
        </svg>

        <div className="relative z-10 flex-1 space-y-1.5">
          {locations.map((location) => {
            const Icon = locationIcon(location.type);
            return (
              <div
                key={location.id}
                ref={(el) => {
                  if (el) locationRefs.current.set(location.id, el);
                  else locationRefs.current.delete(location.id);
                }}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
              >
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">{location.name}</span>
                <span className="truncate text-muted-foreground">{location.city}</span>
              </div>
            );
          })}
        </div>

        <div className="relative z-10 flex w-40 shrink-0 flex-col justify-center gap-3">
          {CHANNEL_NODES.map((channel) => {
            const connection = connections.find((c) => c.name === channel.name);
            const locationLabel = connection?.summary?.location_id ?? connection?.summary?.slave_id;
            return (
              <div
                key={channel.name}
                ref={(el) => {
                  if (el) channelRefs.current.set(channel.name, el);
                  else channelRefs.current.delete(channel.name);
                }}
                className={
                  "rounded-lg border px-2.5 py-2 text-xs " +
                  (connection?.push_ready ? "border-border bg-card" : "border-dashed border-border bg-muted/40 opacity-60")
                }
              >
                <ChannelBadge channel={channel.name} />
                <div className="mt-1 truncate font-mono text-[0.65rem] text-muted-foreground" title={locationLabel}>
                  {connection?.push_ready ? locationLabel : connection?.is_connected ? "No location set" : "Not connected"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
