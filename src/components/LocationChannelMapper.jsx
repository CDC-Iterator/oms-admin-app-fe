import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Boxes, Store, X } from "lucide-react";

import { ChannelBadge } from "./ChannelBadge.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { useGetLocationsQuery } from "../api/services/locations.js";
import {
  useCreateLocationMappingMutation,
  useDeleteLocationMappingMutation,
  useGetChannelConnectionsQuery,
  useGetLocationMappingsQuery,
} from "../api/services/channels.js";
import { useToast } from "../hooks/useToast.js";
import { formatApiError } from "../lib/errors.js";

// Real per-location routing (not a fan-out): each ChannelLocation gets its
// own qty, summed only from the CDC Locations explicitly mapped to it here.
const CHANNEL_META = {
  shopify: { label: "Shopify", stroke: "var(--status-success)" },
  tatacliq: { label: "TataCliq", stroke: "var(--status-info)" },
};
const CHANNEL_ORDER = ["shopify", "tatacliq"];
// Stable references for the "not loaded yet" fallback — a fresh `[]`
// literal on every render would re-trigger the connector-line effect below
// in an infinite loop (its deps include these arrays by reference).
const EMPTY_LIST = [];

function locationIcon(type) {
  return type === "store" ? Store : Boxes;
}

export default function LocationChannelMapper() {
  const { data: locData, isFetching: locFetching } = useGetLocationsQuery();
  const { data: connections, isFetching: connFetching } = useGetChannelConnectionsQuery();
  const { data: mappingsData, isFetching: mapFetching } = useGetLocationMappingsQuery();
  const mappings = mappingsData?.rows ?? EMPTY_LIST;
  const [createMapping] = useCreateLocationMappingMutation();
  const [deleteMapping] = useDeleteLocationMappingMutation();
  const { showToast } = useToast();

  const locations = locData?.rows ?? EMPTY_LIST;

  const channelLocations = useMemo(() => {
    const list = [];
    for (const conn of connections ?? []) {
      for (const cl of conn.locations ?? []) list.push({ ...cl, channel: conn.name });
    }
    return list;
  }, [connections]);

  const channelLocationById = useMemo(
    () => Object.fromEntries(channelLocations.map((cl) => [cl.id, cl])),
    [channelLocations],
  );

  const mappingsByLocation = useMemo(() => {
    const map = new Map();
    for (const m of mappings) {
      if (!map.has(m.location)) map.set(m.location, []);
      map.get(m.location).push(m);
    }
    return map;
  }, [mappings]);

  const containerRef = useRef(null);
  const locationRefs = useRef(new Map());
  const channelLocationRefs = useRef(new Map());
  const [lines, setLines] = useState([]);

  useLayoutEffect(() => {
    function recalc() {
      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const next = [];
      for (const m of mappings) {
        const sourceEl = locationRefs.current.get(m.location);
        const targetEl = channelLocationRefs.current.get(m.channel_location);
        if (!sourceEl || !targetEl) continue;
        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const x1 = sourceRect.right - containerRect.left;
        const y1 = sourceRect.top + sourceRect.height / 2 - containerRect.top;
        const x2 = targetRect.left - containerRect.left;
        const y2 = targetRect.top + targetRect.height / 2 - containerRect.top;
        const midX = (x1 + x2) / 2;
        const channel = channelLocationById[m.channel_location]?.channel;
        next.push({
          key: m.id,
          d: `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`,
          stroke: CHANNEL_META[channel]?.stroke ?? "var(--muted-foreground)",
        });
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
  }, [locations, mappings, channelLocationById]);

  const handleAddMapping = async (locationId, channelLocationId) => {
    if (!channelLocationId) return;
    try {
      await createMapping({ location: locationId, channel_location: Number(channelLocationId) }).unwrap();
    } catch (err) {
      showToast(formatApiError(err));
    }
  };

  const handleRemoveMapping = async (mappingId) => {
    try {
      await deleteMapping(mappingId).unwrap();
    } catch (err) {
      showToast(formatApiError(err));
    }
  };

  const loading = (locFetching || connFetching || mapFetching) && !locations.length;
  if (loading) return <Skeleton className="mt-6 h-48 w-full" />;
  if (locations.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="mb-1 text-sm font-medium">Inventory push mapping</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Map each location's stock to the channel locations it should feed — a channel location's pushed qty is
        summed only from the locations mapped to it here, never a global total.
      </p>
      <div ref={containerRef} className="relative flex justify-between gap-8 rounded-xl border border-border p-4">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          {lines.map((line) => (
            <path key={line.key} d={line.d} fill="none" stroke={line.stroke} strokeWidth="1.5" strokeOpacity="0.5" />
          ))}
        </svg>

        <div className="relative z-10 w-full max-w-sm space-y-2">
          {locations.map((location) => {
            const Icon = locationIcon(location.type);
            const locationMappings = mappingsByLocation.get(location.id) ?? [];
            const mappedIds = new Set(locationMappings.map((m) => m.channel_location));
            const available = channelLocations.filter((cl) => !mappedIds.has(cl.id));
            return (
              <div
                key={location.id}
                ref={(el) => {
                  if (el) locationRefs.current.set(location.id, el);
                  else locationRefs.current.delete(location.id);
                }}
                className="flex flex-col gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs"
              >
                {/* Line 1: location */}
                <div className="flex items-center gap-2">
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{location.name}</span>
                  <span className="truncate text-muted-foreground">{location.city}</span>
                </div>

                {/* Line 2: mapped channel locations as pills */}
                {locationMappings.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    {locationMappings.map((m) => {
                      const cl = channelLocationById[m.channel_location];
                      return (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[0.65rem]"
                        >
                          {cl?.external_id ?? "?"}
                          <button
                            type="button"
                            onClick={() => handleRemoveMapping(m.id)}
                            aria-label="Remove mapping"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="size-2.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Line 3: mapping dropdown */}
                {available.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => handleAddMapping(location.id, e.target.value)}
                    className="h-7 w-full rounded border border-dashed border-border bg-transparent text-[0.7rem] text-muted-foreground"
                  >
                    <option value="">+ Map to channel location…</option>
                    {available.map((cl) => (
                      <option key={cl.id} value={cl.id}>
                        {CHANNEL_META[cl.channel]?.label ?? cl.channel} · {cl.external_id}
                        {cl.name ? ` (${cl.name})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>

        <div className="relative z-10 flex w-64 shrink-0 flex-col gap-3">
          {CHANNEL_ORDER.map((channel) => {
            const locsForChannel = channelLocations.filter((cl) => cl.channel === channel);
            const connection = connections?.find((c) => c.name === channel);
            return (
              <div key={channel} className="space-y-1">
                <ChannelBadge channel={channel} />
                {!connection?.is_connected && (
                  <p className="rounded-lg border border-dashed border-border bg-muted/40 px-2 py-1.5 text-[0.65rem] text-muted-foreground opacity-60">
                    Not connected
                  </p>
                )}
                {connection?.is_connected && locsForChannel.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border bg-muted/40 px-2 py-1.5 text-[0.65rem] text-muted-foreground opacity-60">
                    No locations configured
                  </p>
                )}
                {locsForChannel.map((cl) => (
                  <div
                    key={cl.id}
                    ref={(el) => {
                      if (el) channelLocationRefs.current.set(cl.id, el);
                      else channelLocationRefs.current.delete(cl.id);
                    }}
                    className="rounded-lg border border-border bg-card px-2 py-1.5 font-mono text-[0.65rem] text-muted-foreground"
                    title={cl.name || cl.external_id}
                  >
                    {cl.external_id}
                    {cl.name ? <span className="ml-1 font-sans">· {cl.name}</span> : null}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
