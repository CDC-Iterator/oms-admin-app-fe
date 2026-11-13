import { useEffect, useMemo, useState } from "react";
import { Download, PackageCheck, RefreshCw, Send, Truck } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

import { ColumnHeader } from "../components/ColumnHeader.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import { TableEmptyRow } from "../components/TableEmptyRow.jsx";
import { LineProduct } from "../components/LineProduct.jsx";
import { ReconcileDialog } from "../components/ReconcileDialog.jsx";
import Pagination from "../components/Pagination.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Select } from "@/components/ui/select.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { useGetInventoryLocationSummaryQuery } from "../api/services/inventory.js";
import { useCreateManualShipmentMutation, useDispatchShipmentsMutation } from "../api/services/fulfilment.js";
import { useBookFulfillmentLinesMutation, useGetFulfillmentLinesQuery } from "../api/services/orders.js";
import { useBulkLabelDownload, useLabelDownload } from "../hooks/useLabelDownload.js";
import { useToast } from "../hooks/useToast.js";
import { useAuth } from "../hooks/useAuth.js";
import { canBookShipments } from "../lib/permissions.js";
import ViewFilterChips from "../components/ViewFilterChips.jsx";
import { useServerColumns } from "../hooks/useServerColumns.js";
import SavedViews from "../components/SavedViews.jsx";
import { useSavedViewParams } from "../hooks/useSavedViewParams.js";
import { formatApiError } from "../lib/errors.js";
import { formatPlacedDate } from "../lib/utils.js";

const PAGE_SIZE = 50;
// Column widths live on a <colgroup> so the table keeps its layout when the action bar replaces the header.
const COLUMN_WIDTHS = [3, 19, 8, 8, 9, 3, 8, 12, 8, 9, 7, 6];
// LineFulfillment.Stage — apps.orders.models. `all` (the "All" tab) turns the stage filter off.
const STAGES = [
  { value: "ready_to_ship", label: "Ready to ship" },
  { value: "packed", label: "Packed" },
  { value: "dispatched", label: "Dispatched" },
  { value: "in_transit", label: "In transit" },
  { value: "delivered", label: "Delivered" },
  { value: "rto", label: "RTO" },
  { value: "awaiting_unit", label: "Awaiting unit" },
  { value: "cancelled", label: "Cancelled" },
  { value: "vendor", label: "Vendor fulfilled" },
  { value: "untracked", label: "Shipped, no tracking" },
];
const STAGE_TONE = { ready_to_ship: "pending", packed: "pending", dispatched: "info", in_transit: "info", delivered: "success", rto: "danger" };
const ALL_PARAMS = { stage: "all" };
const READY = "ready_to_ship";
const AWAITING = "awaiting_unit";
const COURIERS = [
  { value: "shipway:delhivery", label: "Shipway · Delhivery" },
  { value: "shipway:bluedart", label: "Shipway · Bluedart" },
  { value: "shipdelight", label: "Shipdelight" },
  { value: "quicklee", label: "Quicklee" },
  { value: "manual", label: "Manual (enter AWB and carrier)" },
];
// Manual bookings: the carrier outside the integrated couriers; "Other" asks for a name.
const MANUAL_CARRIERS = ["Tirupati", "Porter", "Other"];
const COLUMNS = [
  { id: "item_code", header: "Item" },
  { id: "order", header: "Order", meta: { filterIds: true, filterParam: "order_ids" } },
  { id: "placed_at", header: "Date", meta: { filterDateRange: true, filterParam: "placed" } },
  { id: "stage", header: "Stage", enableSorting: false, meta: { filterOptions: STAGES, filterParam: "stage", filterMulti: true } },
];

// The warehouse(s) this line's confirmed unit actually sits in — the order's own allocated location is one value
// for the whole order and can be stale on a split one; it's only the fallback.
const lineLocation = (row) =>
  [...new Set(row.units.map((u) => u.location))].join(", ") || row.allocated_location;

function useDebounced(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// Every order line that still has to go out and already has a unit confirmed — a flat pick list, not one row per order.
export default function FulfillmentLines() {
  const location = useLocation();
  const [search, setSearch] = useState(location.state?.search ?? "");
  const debouncedSearch = useDebounced(search, 300);
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page")) || 1;
  const { data: locations } = useGetInventoryLocationSummaryQuery({});
  const columns = useMemo(
    () => [
      ...COLUMNS,
      {
        id: "allocated_location",
        enableSorting: false,
        meta: {
          filterParam: "location_id",
          filterMulti: true,
          filterOptions: (locations ?? []).map((l) => ({ value: String(l.location_id), label: l.location })),
        },
      },
    ],
    [locations]
  );
  const { table, orderingParam, filterParams, activeFilters, clearFilters } = useServerColumns({
    columns,
    defaultOrdering: "-placed_at",
  });
  const savedView = useSavedViewParams({ search, setSearch });
  // A tab's count is its filters plus the live search, and picking a tab keeps that search.
  const useViewCount = (viewParams) =>
    useGetFulfillmentLinesQuery(
      { ...viewParams, search: debouncedSearch || viewParams.search, page: 1, page_size: 1 },
      { selectFromResult: ({ data }) => ({ count: data?.count }) }
    ).count;
  const stage = searchParams.get("stage");

  const updateParams = (updates) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(updates)) {
          if (value === null || value === undefined || value === "") next.delete(key);
          else next.set(key, String(value));
        }
        return next;
      },
      { replace: true }
    );
  const setPage = (nextPage) => updateParams({ page: nextPage <= 1 ? null : nextPage });
  // The screen opens on Ready to ship (the daily pick list); the stage lives in the URL like any other filter.
  useEffect(() => {
    if (!stage) updateParams({ stage: READY });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const { data, isFetching, error, refetch } = useGetFulfillmentLinesQuery({
    page,
    search: debouncedSearch || undefined,
    ...filterParams,
    stage: stage || READY,
    invoice: searchParams.get("invoice") || undefined,
    pos_push: searchParams.get("pos_push") || undefined,
    waiting_hours: searchParams.get("waiting_hours") || undefined,
    ordering: orderingParam,
  });
  const rows = data?.rows ?? [];

  // Selection is by line id (kept with its row, for the booking summary) and survives paging;
  // the header box toggles the lines on the current page.
  const [selected, setSelected] = useState(() => new Map());
  const toggle = (row) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(row.line_id)) next.delete(row.line_id);
      else next.set(row.line_id, row);
      return next;
    });
  const { user } = useAuth();
  const canBook = canBookShipments(user);
  // The checkbox column exists only on the Ready to ship view, and only for someone who can book.
  const bulkEnabled = canBook && (stage || READY) === READY;
  // Lines waiting for a unit can be reconciled once their SKU is fixed in Shopify.
  const reconcileEnabled = canBook && stage === AWAITING;
  const selectEnabled = bulkEnabled || reconcileEnabled;
  const selectableStage = reconcileEnabled ? AWAITING : READY;
  const selectable = rows.filter((r) => r.stage === selectableStage);
  const pageSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.line_id));
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Map(prev);
      for (const r of selectable) {
        if (pageSelected) next.delete(r.line_id);
        else next.set(r.line_id, r);
      }
      return next;
    });

  useEffect(() => {
    if (!selectEnabled) setSelected(new Map());
  }, [selectEnabled, stage]);
  // Every other stage lists packages already booked: tick the ones with a courier label and download them as one PDF.
  const labelsEnabled = !selectEnabled && (stage || READY) !== READY && stage !== AWAITING;
  const checks = selectEnabled || labelsEnabled;
  const [labelSel, setLabelSel] = useState(() => new Map());
  useEffect(() => {
    setLabelSel(new Map());
  }, [stage, labelsEnabled]);
  const labelRows = rows.filter((r) => r.has_label && r.shipment_id);
  const pageLabelsSelected = labelRows.length > 0 && labelRows.every((r) => labelSel.has(r.shipment_id));
  const toggleLabel = (row) =>
    setLabelSel((prev) => {
      const next = new Map(prev);
      if (next.has(row.shipment_id)) next.delete(row.shipment_id);
      else next.set(row.shipment_id, row);
      return next;
    });
  const toggleLabelPage = () =>
    setLabelSel((prev) => {
      const next = new Map(prev);
      for (const r of labelRows) {
        if (pageLabelsSelected) next.delete(r.shipment_id);
        else next.set(r.shipment_id, r);
      }
      return next;
    });
  const { download: downloadLabels, downloading: downloadingLabels } = useBulkLabelDownload();
  const { download: downloadOneLabel } = useLabelDownload();
  const [dispatchShipments, { isLoading: dispatching }] = useDispatchShipmentsMutation();
  const markDispatched = async () => {
    try {
      const { dispatched, skipped } = await dispatchShipments([...labelSel.keys()]).unwrap();
      showToast(`${dispatched.length} shipment${dispatched.length === 1 ? "" : "s"} marked dispatched.${skipped.length ? ` ${skipped.length} skipped.` : ""}`);
      setLabelSel(new Map());
    } catch (err) {
      showToast(formatApiError(err));
    }
  };
  const selectedCount = selectEnabled ? selected.size : labelSel.size;
  const clearSelection = () => (selectEnabled ? setSelected(new Map()) : setLabelSel(new Map()));
  const [bookOpen, setBookOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [courier, setCourier] = useState("shipway:delhivery");
  const { showToast } = useToast();
  const [createManual, { isLoading: bookingManual, error: manualError }] = useCreateManualShipmentMutation();
  const [carrier, setCarrier] = useState(MANUAL_CARRIERS[0]);
  const [otherCarrier, setOtherCarrier] = useState("");
  const [awb, setAwb] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [bookResult, setBookResult] = useState(null);
  const [book, { isLoading: booking, error: bookError }] = useBookFulfillmentLinesMutation();
  // One shipment per order and warehouse — the same grouping the server uses.
  const shipmentCount = new Set([...selected.values()].map((r) => `${r.order_id}:${r.units[0]?.location_id}`)).size;
  const orderCount = new Set([...selected.values()].map((r) => r.order_id)).size;
  // A manual booking is one shipment for one order, so it needs every selected line to be on the same order.
  const manualOk = orderCount === 1;
  const isManual = courier === "manual";
  const carrierName = carrier === "Other" ? otherCarrier.trim() : carrier;
  const manualReady = manualOk && Boolean(awb.trim()) && Boolean(carrierName);
  const closeBook = () => {
    setBookOpen(false);
    if (bookResult?.queued?.length) setSelected(new Map());
    setBookResult(null);
  };
  const submitManual = async () => {
    const first = [...selected.values()][0];
    try {
      await createManual({
        orderId: first.order_id,
        awb_number: awb.trim(),
        carrier_name: carrierName,
        tracking_url: trackingUrl.trim() || undefined,
        line_items: [...selected.values()].map((r) => ({ line_item: r.line_id, qty: r.qty })),
      }).unwrap();
      showToast(`${first.order_name} booked with ${carrierName} (AWB ${awb.trim()}).`);
      setSelected(new Map());
      setAwb("");
      setTrackingUrl("");
      setOtherCarrier("");
      setBookOpen(false);
    } catch {
      /* shown from manualError */
    }
  };
  const submitBook = async () => {
    if (isManual) return submitManual();
    try {
      const [courierName, carrierName] = courier.split(":");
      setBookResult(await book({ courier: courierName, carrier: carrierName, line_ids: [...selected.keys()] }).unwrap());
    } catch {
      /* shown from bookError */
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="mb-4 shrink-0 text-sm text-muted-foreground">
        Every order line by fulfilment stage — pick a tab, or filter the Stage column
        {data ? ` · ${data.count.toLocaleString("en-IN")} line${data.count === 1 ? "" : "s"}` : ""}.
      </p>

      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <Input
          placeholder="Search order, invoice, customer, item, barcode…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="min-w-48 flex-1"
        />
        {canBook && stage === AWAITING && (
          <Button size="sm" variant="outline" onClick={() => setReconcileOpen(true)}>
            <RefreshCw className="size-3.5" />
            Reconcile orders…
          </Button>
        )}
        <ViewFilterChips table={table} onClear={clearFilters} keys={["invoice", "waiting_hours", "pos_push"]} />
        <SavedViews resource="fulfillments" params={savedView.params} onApply={savedView.applyKeepingSearch} useCount={useViewCount} ignoreParams={["search"]} allParams={ALL_PARAMS} />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {formatApiError(error)}{" "}
            <Button size="sm" variant="outline" onClick={refetch}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : isFetching && !data ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 && activeFilters === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="No lines here"
          description="Nothing is at this stage right now."
        />
      ) : (
        <div
          aria-busy={isFetching}
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl ring-1 ring-border [&>[data-slot=table-container]]:min-h-0 [&>[data-slot=table-container]]:flex-1"
        >
          <Table className="table-compact table-scroll [&_td]:py-1 [&_td]:text-xs [&_th]:h-10">
            <colgroup>
              {(checks ? COLUMN_WIDTHS : [COLUMN_WIDTHS[0] + COLUMN_WIDTHS[1], ...COLUMN_WIDTHS.slice(2)]).map((w, i) => (
                <col key={i} style={{ width: `${w}%` }} />
              ))}
            </colgroup>
            <TableHeader>
              {checks && selectedCount > 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableHead className="bg-muted/40 shadow-[inset_0_-1px_0_0_var(--border)]">
                    <input
                      type="checkbox"
                      className="oms-checkbox mx-auto"
                      checked
                      onChange={clearSelection}
                      aria-label="Clear selection"
                    />
                  </TableHead>
                  <TableHead colSpan={11} className="bg-muted/40 shadow-[inset_0_-1px_0_0_var(--border)]">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        {selectedCount} selected
                      </span>
                      {bulkEnabled && canBook && (
                        <Button size="sm" variant="outline" onClick={() => setBookOpen(true)}>
                          <Truck className="size-3.5" />
                          Book shipments
                        </Button>
                      )}
                      {reconcileEnabled && (
                        <Button size="sm" variant="outline" onClick={() => setReconcileOpen(true)}>
                          <RefreshCw className="size-3.5" />
                          Reconcile {orderCount} order{orderCount === 1 ? "" : "s"}
                        </Button>
                      )}
                      {labelsEnabled && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={downloadingLabels}
                          onClick={async () => {
                            if (await downloadLabels([...labelSel.keys()])) setLabelSel(new Map());
                          }}
                        >
                          <Download className="size-3.5" />
                          {downloadingLabels ? "Preparing…" : `Download ${selectedCount} label${selectedCount === 1 ? "" : "s"}`}
                        </Button>
                      )}
                      {labelsEnabled && stage === "packed" && canBook && (
                        <Button size="sm" variant="outline" disabled={dispatching} onClick={markDispatched}>
                          <Send className="size-3.5" />
                          {dispatching ? "Saving…" : "Mark dispatched"}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={clearSelection}>
                        Clear selection
                      </Button>
                    </div>
                  </TableHead>
                </TableRow>
              )}
              <TableRow className={checks && selectedCount > 0 ? "hidden" : "hover:bg-transparent"}>
                {checks && (
                  <TableHead className="w-[3%] shadow-[inset_0_-1px_0_0_var(--border)]">
                    <input
                      type="checkbox"
                      className="oms-checkbox mx-auto"
                      checked={selectEnabled ? pageSelected : pageLabelsSelected}
                      onChange={selectEnabled ? togglePage : toggleLabelPage}
                      disabled={labelsEnabled && labelRows.length === 0}
                      aria-label={selectEnabled ? "Select all lines on this page" : "Select all labels on this page"}
                    />
                  </TableHead>
                )}
                <TableHead className="w-[22%] shadow-[inset_0_-1px_0_0_var(--border)]">
                  <ColumnHeader column={table.getColumn("item_code")} title="Item" />
                </TableHead>
                <TableHead className="w-[8%] shadow-[inset_0_-1px_0_0_var(--border)]">
                  <ColumnHeader column={table.getColumn("order")} title="Order" />
                </TableHead>
                <TableHead className="w-[10%] shadow-[inset_0_-1px_0_0_var(--border)]">Invoice</TableHead>
                <TableHead className="w-[9%] shadow-[inset_0_-1px_0_0_var(--border)]">
                  <ColumnHeader column={table.getColumn("placed_at")} title="Date" />
                </TableHead>
                <TableHead className="shadow-[inset_0_-1px_0_0_var(--border)] text-center">Qty</TableHead>
                <TableHead className="shadow-[inset_0_-1px_0_0_var(--border)]">
                  <ColumnHeader column={table.getColumn("stage")} title="Stage" />
                </TableHead>
                <TableHead className="shadow-[inset_0_-1px_0_0_var(--border)]">Courier / AWB</TableHead>
                <TableHead className="shadow-[inset_0_-1px_0_0_var(--border)]">Barcode</TableHead>
                <TableHead className="shadow-[inset_0_-1px_0_0_var(--border)]">
                  <ColumnHeader column={table.getColumn("allocated_location")} title="Location" />
                </TableHead>
                <TableHead className="shadow-[inset_0_-1px_0_0_var(--border)]">Customer</TableHead>
                <TableHead className="shadow-[inset_0_-1px_0_0_var(--border)]">Destination</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className={isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}>
              {rows.length === 0 && <TableEmptyRow colSpan={checks ? 12 : 11} />}
              {rows.map((row) => (
                <TableRow key={row.row_id ?? row.line_id} data-state={selected.has(row.line_id) || labelSel.has(row.shipment_id) ? "selected" : undefined}>
                  {labelsEnabled && (
                    <TableCell>
                      {row.has_label && row.shipment_id && (
                        <input
                          type="checkbox"
                          className="oms-checkbox mx-auto"
                          checked={labelSel.has(row.shipment_id)}
                          onChange={() => toggleLabel(row)}
                          aria-label={`Select label for ${row.order_name} ${row.tracking_number || ""}`}
                        />
                      )}
                    </TableCell>
                  )}
                  {selectEnabled && (
                    <TableCell>
                      {row.stage === selectableStage && (
                        <input
                          type="checkbox"
                          className="oms-checkbox mx-auto"
                          checked={selected.has(row.line_id)}
                          onChange={() => toggle(row)}
                          aria-label={`Select ${row.order_name} ${row.external_sku}`}
                        />
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <LineProduct line={row} layout="card" dense>
                      {row.stage === AWAITING && !row.pos_sent && row.pos_error && (
                        <span title={row.pos_error.reason || undefined}>
                          <StatusBadge tone="danger" className="status-chip--compact">
                            POS rejected {row.pos_error.http_status ? `(HTTP ${row.pos_error.http_status})` : "(unreachable)"}
                          </StatusBadge>
                        </span>
                      )}
                      {row.stage === AWAITING && !row.pos_sent && !row.pos_error && (
                        <StatusBadge tone={row.item_code || row.bundle ? "pending" : "danger"} className="status-chip--compact">
                          {row.item_code || row.bundle ? "Linked · not sent to POS" : "SKU not in catalog"}
                        </StatusBadge>
                      )}
                      {row.bundle && (
                        <StatusBadge tone={row.bundle.split.length > 0 ? "danger" : row.bundle.billed >= row.bundle.parts ? "success" : "pending"} className="status-chip--compact">
                          Bundle · {row.bundle.billed} of {row.bundle.parts} parts
                          {row.bundle.split.length > 0 ? ` · split: ${row.bundle.split.join(" + ")}` : ""}
                        </StatusBadge>
                      )}
                    </LineProduct>
                  </TableCell>
                  <TableCell className="font-mono">
                    <Link to={`/orders/${row.order_id}`} state={{ from: location.pathname + location.search, search }} className="text-primary hover:underline" title={row.customer_name}>
                      {row.order_name}
                    </Link>
                  </TableCell>
                  <TableCell className="truncate font-mono" title={row.invoice_id || undefined}>
                    {row.invoice_id || "—"}
                  </TableCell>
                  <TableCell className="truncate">{formatPlacedDate(row.placed_at)}</TableCell>
                  <TableCell className="text-center font-mono tabular-nums">{row.qty}</TableCell>
                  <TableCell>
                    <StatusBadge tone={STAGE_TONE[row.stage] ?? "neutral"} className="status-chip--compact">
                      {row.stage_label}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="truncate" title={[row.carrier, row.tracking_number, row.shipment_status].filter(Boolean).join(" · ") || undefined}>
                    {row.carrier || row.tracking_number ? (
                      <div className="leading-tight">
                        <div className="truncate">{row.carrier || "—"}</div>
                        {row.tracking_number &&
                          (row.tracking_url ? (
                            <a href={row.tracking_url} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-primary hover:underline">
                              {row.tracking_number}
                            </a>
                          ) : (
                            <span className="font-mono text-[11px] text-muted-foreground">{row.tracking_number}</span>
                          ))}
                        {row.has_label && row.shipment_id && (
                          <button
                            type="button"
                            onClick={() => downloadOneLabel({ id: row.shipment_id }, row.order_id)}
                            className="ml-2 inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
                            title="Download this shipment's label"
                          >
                            <Download className="size-3" />
                            Label
                          </button>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.units.map((u) => (
                        <StatusBadge key={u.barcode} tone="success" className="status-chip--compact">
                          {u.barcode}
                        </StatusBadge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="truncate" title={lineLocation(row) || undefined}>
                    {lineLocation(row) || "—"}
                  </TableCell>
                  <TableCell className="truncate" title={row.customer_name || undefined}>
                    {row.customer_name || "—"}
                  </TableCell>
                  <TableCell
                    className="truncate"
                    title={[row.shipping_city, row.shipping_pincode, row.delivery_method].filter(Boolean).join(" · ") || undefined}
                  >
                    <div className="leading-tight">
                      <div className="truncate">{[row.shipping_city, row.shipping_pincode].filter(Boolean).join(" · ") || "—"}</div>
                      {row.delivery_method && <div className="truncate text-[11px] text-muted-foreground">{row.delivery_method}</div>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="shrink-0">
        <Pagination page={page} pageSize={PAGE_SIZE} count={data?.count ?? 0} onPageChange={setPage} loading={isFetching} />
      </div>

      <ReconcileDialog
        open={reconcileOpen}
        onOpenChange={(open) => {
          setReconcileOpen(open);
          if (!open) setSelected(new Map());
        }}
        initialOrders={[...new Set([...selected.values()].map((r) => r.order_name))].join(", ")}
      />

      <Dialog open={bookOpen} onOpenChange={(open) => (open ? setBookOpen(true) : closeBook())}>
        <DialogContent className="flex max-h-[80vh] w-full max-w-lg flex-col gap-3 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Book shipments</DialogTitle>
            <DialogDescription>
              {selected.size} line{selected.size === 1 ? "" : "s"} across {orderCount} order{orderCount === 1 ? "" : "s"} —{" "}
              {isManual
                ? "one manual shipment."
                : `${shipmentCount} shipment${shipmentCount === 1 ? "" : "s"}, one per order and warehouse.`}
            </DialogDescription>
          </DialogHeader>

          {bookResult ? (
            <div className="min-h-0 space-y-2 overflow-y-auto text-sm">
              <p className="font-medium">
                {bookResult.queued.length} shipment{bookResult.queued.length === 1 ? "" : "s"} queued with {COURIERS.find((c) => c.value === courier)?.label ?? courier}.
              </p>
              <ul className="space-y-1 text-xs">
                {bookResult.queued.map((q) => (
                  <li key={`${q.order_id}-${q.location}`} className="font-mono">
                    {q.order_name} · {q.location} · {q.weight_kg} kg
                  </li>
                ))}
              </ul>
              {bookResult.skipped.length > 0 && (
                <>
                  <p className="pt-1 font-medium text-destructive">{bookResult.skipped.length} skipped</p>
                  <ul className="space-y-1 text-xs">
                    {bookResult.skipped.map((k, i) => (
                      <li key={i}>
                        <span className="font-mono">{k.order_name ?? `line ${k.line_id}`}</span> — {k.reason}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="text-xs text-muted-foreground">
                Booking runs in the background — the lines leave this list once the courier confirms.
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <label className="block space-y-1">
                <span className="text-xs font-medium">Courier</span>
                <Select value={courier} onChange={(e) => setCourier(e.target.value)} className="w-full">
                  {COURIERS.map((c) => (
                    <option key={c.value} value={c.value} disabled={c.value === "manual" && !manualOk}>
                      {c.label}
                      {c.value === "manual" && !manualOk ? " — select one order's lines" : ""}
                    </option>
                  ))}
                </Select>
              </label>
              {isManual ? (
                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium">Carrier</span>
                    <Select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="w-full">
                      {MANUAL_CARRIERS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </label>
                  {carrier === "Other" && (
                    <Input placeholder="Carrier name" value={otherCarrier} onChange={(e) => setOtherCarrier(e.target.value)} maxLength={100} />
                  )}
                  <label className="block space-y-1">
                    <span className="text-xs font-medium">AWB / tracking number</span>
                    <Input value={awb} onChange={(e) => setAwb(e.target.value)} maxLength={100} />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium">Tracking link (optional)</span>
                    <Input type="url" placeholder="https://…" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} />
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Books the selected lines as one manual shipment and sends the tracking details to Shopify.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Parcel weight is each shipment's lines (Shopify weight × quantity). A shipment whose lines have no
                  weight is skipped — book it from the order page.
                </p>
              )}
              {isManual && !manualOk && (
                <p className="text-xs text-destructive">
                  A manual booking covers one order — the selected lines are on {orderCount} orders. Go back and select one order's lines.
                </p>
              )}
              {isManual && manualError && <p className="text-xs text-destructive">{formatApiError(manualError)}</p>}
              {!isManual && bookError && <p className="text-xs text-destructive">{formatApiError(bookError)}</p>}
            </div>
          )}

          <DialogFooter>
            {bookResult ? (
              <Button onClick={closeBook}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={closeBook} disabled={booking || bookingManual}>
                  Cancel
                </Button>
                <Button onClick={submitBook} disabled={booking || bookingManual || (isManual && !manualReady)}>
                  {booking || bookingManual
                    ? "Booking…"
                    : isManual
                      ? "Book manually"
                      : `Book ${shipmentCount} shipment${shipmentCount === 1 ? "" : "s"}`}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
