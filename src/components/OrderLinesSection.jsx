import { Ban, MapPin, MoreHorizontal, Package, PackageCheck, PackageOpen, Pencil, Plus, Truck, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu.jsx";
import { StatusBadge } from "@/components/status-badge.jsx";
import { shipmentTone } from "../lib/status.js";
import { LineProduct } from "./LineProduct.jsx";

const inr = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value ?? 0));

const longDate = (value) =>
  new Date(value).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

function GroupHeading({ icon: Icon, tone, title, reference, children }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={
          "flex size-9 shrink-0 items-center justify-center rounded-lg " +
          (tone === "pending" ? "bg-amber-200/70 text-amber-900" : "bg-muted text-foreground")
        }
      >
        <Icon className="size-4" />
      </span>
      <h3 className="text-sm font-semibold">{title}</h3>
      {reference && <span className="text-sm text-muted-foreground">{reference}</span>}
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  );
}

function LocationPill({ name }) {
  if (!name) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
      <MapPin className="size-3" />
      {name}
    </span>
  );
}

function LineRow({ entry, group, orderId, isAdmin, checkboxColumn, showCheckbox, disabledReason, selected, onToggle, renderUnit, onLineAction }) {
  const { line, qty } = entry;
  const isOpen = !group.shipmentRef && !group.channelRef && !group.removed;
  const canCancel = isAdmin && isOpen && line.can_cancel;
  const canReturn = isAdmin && group.shipmentRef?.status === "delivered" && line.can_return;
  const hasUnit = isOpen;
  return (
    <div className="py-1.5 first:pt-0 last:pb-0 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-border/60">
      <div className="flex items-start gap-3">
        {checkboxColumn &&
          (showCheckbox ? (
            <input
              type="checkbox"
              className="oms-checkbox mt-2.5"
              checked={selected && !disabledReason}
              disabled={Boolean(disabledReason)}
              title={disabledReason || undefined}
              onChange={(e) => onToggle(line.id, e.target.checked)}
              aria-label={`Select ${line.title || line.external_sku} for a shipment`}
            />
          ) : (
            <span className="size-4 shrink-0" aria-hidden />
          ))}
        <LineProduct line={line} layout="card">
          {hasUnit && line.sku && renderUnit(line)}
          {line.is_dropship && <StatusBadge tone="pending">Shipturtle</StatusBadge>}
          {line.ships_in && line.ships_in.toLowerCase() !== "ready to ship" && <StatusBadge tone="pending">Ships in {line.ships_in}</StatusBadge>}
        </LineProduct>
        <div className="flex shrink-0 items-center gap-3 pt-1 text-sm tabular-nums">
          <span className="w-20 text-right text-muted-foreground">{inr(line.price)}</span>
          <span className="text-muted-foreground">×</span>
          <span className="rounded-md bg-muted px-2 py-0.5 font-medium">{qty}</span>
          <span className="w-24 text-right font-medium">{inr(Number(line.price ?? 0) * qty)}</span>
          {canCancel || canReturn ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-sm" className="-mr-1" aria-label="Line actions" />}
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                {canCancel && (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onLineAction({ orderId, line, action: "cancel" })}
                  >
                    <Ban />
                    Cancel item
                  </DropdownMenuItem>
                )}
                {canReturn && (
                  <DropdownMenuItem onClick={() => onLineAction({ orderId, line, action: "return" })}>
                    <Undo2 />
                    Return item
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="-mr-1 size-7 shrink-0" aria-hidden />
          )}
        </div>
      </div>
    </div>
  );
}

/** Shopify-style Lines section: a "Lines" heading, then one card per group — Unfulfilled first, then
 *  one Fulfilled card per shipment. Behaviour (select, book, edit, cancel/return) is unchanged. */
export function OrderLinesSection({
  order,
  orderId,
  lineGroups,
  shipmentById,
  isAdmin,
  canShip,
  shippableLineIds,
  selectedLineIds,
  onToggleLine,
  onBookShipment,
  onEditShipment,
  onLineAction,
  renderUnit,
  trackingEventLabels,
}) {
  const orderName = order.order_name || order.external_order_id;
  let shipmentNumber = 0;
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">Lines</h2>

      {lineGroups.map((group) => {
        if (group.removed) {
          return (
            <div key={group.key} className="space-y-1.5">
              <h3 className="text-sm font-semibold">Removed</h3>
              <div className="rounded-xl bg-card p-3 shadow-xs ring-1 ring-border">
                {group.entries.map((entry) => (
                  <LineRow
                    key={`${group.key}-${entry.line.id}`}
                    entry={entry}
                    group={group}
                    orderId={orderId}
                    isAdmin={isAdmin}
                    checkboxColumn={false}
                    showCheckbox={false}
                    selected={false}
                    onToggle={onToggleLine}
                    renderUnit={renderUnit}
                    onLineAction={onLineAction}
                  />
                ))}
              </div>
            </div>
          );
        }
        const ref = group.shipmentRef;
        const channel = group.channelRef;
        const isOpen = !ref && !channel;
        const shipment = ref ? shipmentById.get(ref.id) : null;
        if (ref) shipmentNumber += 1;
        const isManual = ref?.courier === "manual";
        const trackingLabel =
          (shipment?.last_reported_tracking_event_status &&
            trackingEventLabels[shipment.last_reported_tracking_event_status]) ??
          ref?.status?.replace(/_/g, " ");
        const eventDate = channel ? channel.created_at : shipment?.last_reported_tracking_event_at || shipment?.created_at;
        const carrier = channel ? channel.carrier : ref?.carrier_name || ref?.courier;
        const awb = channel ? channel.tracking_number : shipment?.awb_number;
        const trackingUrl = channel ? channel.tracking_url : shipment?.tracking_url;
        // Where the units on these lines actually sit — an order can span warehouses, so don't assume one.
        const unitLocations = [...new Set(group.entries.flatMap((e) => e.line.confirmed_unit_locations ?? []))];
        const locationNames = channel
          ? [channel.location_name]
          : unitLocations.length > 0
            ? unitLocations
            : [order.allocated_location];
        const chipStatus = channel ? channel.shipment_status : ref?.status;
        const chipLabel = channel ? channel.shipment_status?.replace(/_/g, " ") : trackingLabel;

        return (
          <div key={group.key} className="space-y-1.5">
            <GroupHeading
              icon={isOpen ? PackageOpen : PackageCheck}
              tone={isOpen ? "pending" : "done"}
              title={isOpen ? "Unfulfilled" : "Fulfilled"}
              reference={channel ? channel.label : ref ? `${orderName}-F${shipmentNumber}` : null}
            >
              {channel && <span className="text-xs text-muted-foreground">Fulfilled in Shopify</span>}
              {isOpen && canShip && group.entries.some((e) => shippableLineIds.has(e.line.id)) && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={selectedLineIds.size === 0}
                  title={selectedLineIds.size === 0 ? "Select the lines to ship first" : undefined}
                  onClick={onBookShipment}
                >
                  <Plus className="size-3.5" />
                  Book Shipment
                </Button>
              )}
              {isManual && canShip && shipment && (
                <Button variant="ghost" size="icon-sm" onClick={() => onEditShipment(shipment)} aria-label="Edit shipment">
                  <Pencil className="size-3.5" />
                </Button>
              )}
            </GroupHeading>

            <div className="rounded-xl bg-card p-3 shadow-xs ring-1 ring-border">
              {(ref || channel || order.allocated_location || unitLocations.length > 0) && (
                <div className="mb-2 space-y-1 border-b border-border pb-2">
                  <div className="flex items-center justify-between gap-2">
                    {chipStatus ? <StatusBadge tone={shipmentTone(chipStatus)}>{chipLabel}</StatusBadge> : <span />}
                    <span className="flex flex-wrap justify-end gap-1">
                      {locationNames.map((name) => (
                        <LocationPill key={name} name={name} />
                      ))}
                    </span>
                  </div>
                  {(ref || channel) && eventDate && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Truck className="size-4" />
                      {longDate(eventDate)}
                    </p>
                  )}
                  {(ref || channel) && awb && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Package className="size-4" />
                      <span className="capitalize">{carrier || "Other"}</span> tracking:{" "}
                      {trackingUrl ? (
                        <a href={trackingUrl} target="_blank" rel="noreferrer" className="font-mono text-foreground underline">
                          {awb}
                        </a>
                      ) : (
                        <span className="font-mono text-foreground">{awb}</span>
                      )}
                    </p>
                  )}
                </div>
              )}

              <div>
                {group.entries.map((entry) => (
                  <LineRow
                    key={`${group.key}-${entry.line.id}`}
                    entry={entry}
                    group={group}
                    orderId={orderId}
                    isAdmin={isAdmin}
                    checkboxColumn={isOpen && canShip && order.channel === "shopify" && group.entries.some((e) => !e.line.is_dropship)}
                    showCheckbox={isOpen && canShip && order.channel === "shopify" && !entry.line.is_dropship}
                    disabledReason={
                      shippableLineIds.has(entry.line.id)
                        ? null
                        : entry.line.is_fully_confirmed
                          ? "Nothing left to ship on this line"
                          : "Waiting for a POS booking — bill a unit for this line in POS first"
                    }
                    selected={selectedLineIds.has(entry.line.id)}
                    onToggle={onToggleLine}
                    renderUnit={renderUnit}
                    onLineAction={onLineAction}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
