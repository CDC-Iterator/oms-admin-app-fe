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
import { useGetProductsQuery } from "../api/services/catalog.js";
import { useGetUnmappedQuery, useMapUnmappedMutation } from "../api/services/unmapped.js";
import { formatApiError } from "../lib/errors.js";
import { useToast } from "../hooks/useToast.js";

export default function UnmappedSkus() {
  const { showToast } = useToast();
  const { data, isFetching, error, refetch } = useGetUnmappedQuery();
  const { data: products } = useGetProductsQuery({ active: true });
  const [mapUnmapped, { isLoading: isMapping }] = useMapUnmappedMutation();

  const [target, setTarget] = useState(null);
  const [skuId, setSkuId] = useState("");
  const [mapError, setMapError] = useState(null);

  const openMap = (row) => {
    setMapError(null);
    setTarget(row);
    setSkuId("");
  };

  const handleMap = async (event) => {
    event.preventDefault();
    setMapError(null);
    try {
      await mapUnmapped({ id: target.id, sku: Number(skuId) }).unwrap();
      showToast(`${target.external_sku} mapped — every order line blocked on it re-suggests a unit.`);
      setTarget(null);
    } catch (err) {
      setMapError(formatApiError(err));
    }
  };

  const COLUMNS = [
    { key: "channel", label: "Channel", render: (row) => <ChannelBadge channel={row.channel} /> },
    { key: "external_sku", label: "External SKU", mono: true },
    { key: "external_variant_id", label: "External variant ID", mono: true },
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
        Channel SKUs with no matching POS 2.0 item code — every blocked order line re-suggests a
        unit the moment this is mapped.
      </p>
      <ListEyebrow count={data?.count ?? 0} noun="unmapped" live />
      <DataTable
        columns={COLUMNS}
        rows={data?.rows ?? []}
        loading={isFetching}
        error={formatApiError(error)}
        onRetry={refetch}
        empty={
          <EmptyState
            icon={CheckCircle2}
            title="Nothing unmapped — every SKU resolves"
            description="A channel SKU with no matching item code will show up here instead of getting lost."
          />
        }
      />

      <Sheet open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Map {target?.external_sku}</SheetTitle>
            <SheetDescription>Link this channel SKU to a POS 2.0 item code.</SheetDescription>
          </SheetHeader>
          <form id="map-form" className="flex flex-1 flex-col gap-4 px-4" onSubmit={handleMap}>
            {mapError && (
              <Alert variant="destructive">
                <AlertDescription>{mapError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="item-code">Item code</Label>
              <Select id="item-code" className="w-full" value={skuId} onChange={(e) => setSkuId(e.target.value)}>
                <option value="" disabled>
                  Select an item code
                </option>
                {(products?.rows ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.item_code} — {p.title}
                  </option>
                ))}
              </Select>
            </div>
          </form>
          <SheetFooter>
            <Button type="submit" form="map-form" disabled={isMapping || !skuId}>
              {isMapping ? "Mapping…" : "Map & rejoin flow"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
