import { useState } from "react";
import { CheckCircle2, Link2 } from "lucide-react";

import DataTable from "../components/DataTable.jsx";
import { ChannelBadge } from "../components/ChannelBadge.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import { ListEyebrow } from "../components/list-eyebrow.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Label } from "@/components/ui/label.jsx";
import { Select } from "@/components/ui/select.jsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.jsx";
import { useGetInventoryPoolQuery } from "../api/services/inventory.js";
import { useGetPendingQuery, useMapPendingMutation } from "../api/services/pending.js";
import { formatApiError } from "../lib/errors.js";
import { useToast } from "../hooks/useToast.js";

export default function PendingOrders() {
  const { showToast } = useToast();
  const { data, isFetching, error, refetch } = useGetPendingQuery();
  const { data: pool } = useGetInventoryPoolQuery();
  const [mapPending, { isLoading: isMapping }] = useMapPendingMutation();

  const [target, setTarget] = useState(null);
  const [itemCode, setItemCode] = useState("");
  const [mapError, setMapError] = useState(null);

  const openMap = (row) => {
    setMapError(null);
    setTarget(row);
    setItemCode(row.suggestedItemCode || "");
  };

  const handleMap = async (event) => {
    event.preventDefault();
    setMapError(null);
    try {
      await mapPending({ id: target.id, itemCode }).unwrap();
      showToast(`${target.channelSku} mapped to ${itemCode} — order rejoined the flow.`);
      setTarget(null);
    } catch (err) {
      setMapError(formatApiError(err));
    }
  };

  const COLUMNS = [
    { key: "channel", label: "Channel", render: (row) => <ChannelBadge channel={row.channel} /> },
    { key: "channelSku", label: "Channel SKU", mono: true },
    { key: "title", label: "Item (from catalogue)" },
    { key: "customerName", label: "Customer" },
    {
      key: "placedAt",
      label: "Placed",
      mono: true,
      render: (row) => new Date(row.placedAt).toLocaleString(),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <Button size="sm" variant="outline" onClick={() => openMap(row)}>
          <Link2 className="size-3.5" />
          Map SKU
        </Button>
      ),
    },
  ];

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Orders carrying a channel SKU with no POS 2.0 item code held here — nothing is lost, it just
        waits for a mapping. Once mapped, the order rejoins the normal flow automatically.
      </p>
      <ListEyebrow count={data?.count ?? 0} noun="pending" label="Blocked on a mapping" live />
      <DataTable
        columns={COLUMNS}
        rows={data?.rows ?? []}
        loading={isFetching}
        error={formatApiError(error)}
        onRetry={refetch}
        empty={
          <EmptyState
            icon={CheckCircle2}
            title="Nothing blocked — every SKU is mapped"
            description="Orders with an unrecognized channel SKU will show up here instead of getting lost."
          />
        }
      />

      <Sheet open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Map {target?.channelSku}</SheetTitle>
            <SheetDescription>
              Link this channel SKU to a POS 2.0 item code. We've suggested the closest catalogue
              match — confirm or pick a different one.
            </SheetDescription>
          </SheetHeader>
          <form id="map-form" className="flex flex-1 flex-col gap-4 px-4" onSubmit={handleMap}>
            {mapError && (
              <Alert variant="destructive">
                <AlertDescription>{mapError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="channel-sku">Channel SKU</Label>
              <p id="channel-sku" className="font-mono text-sm">
                {target?.channelSku}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-code">POS 2.0 item code</Label>
              <Select id="item-code" className="w-full" value={itemCode} onChange={(e) => setItemCode(e.target.value)}>
                <option value="" disabled>
                  Select an item code
                </option>
                {(pool?.rows ?? []).map((item) => (
                  <option key={item.itemCode} value={item.itemCode}>
                    {item.itemCode} — {item.title}
                    {item.itemCode === target?.suggestedItemCode ? " (suggested)" : ""}
                  </option>
                ))}
              </Select>
            </div>
          </form>
          <SheetFooter>
            <Button type="submit" form="map-form" disabled={isMapping || !itemCode}>
              {isMapping ? "Mapping…" : "Map & rejoin flow"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
