import { useState } from "react";
import { Zap } from "lucide-react";

import { useGetChannelsQuery } from "@/api/services/channels.js";
import { useGetInventoryPoolQuery } from "@/api/services/inventory.js";
import { useSellUnitMutation } from "@/api/services/orders.js";
import { formatApiError } from "@/lib/errors.js";
import { Button } from "@/components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { Select } from "@/components/ui/select.jsx";
import { useToast } from "@/hooks/useToast.js";

/**
 * "Sell a unit on any channel and watch it move" — the live demo's core
 * mechanic, reproduced here. Picking an item + channel and selling it drives
 * the whole real-time story: the pool decrements, an order appears reserved
 * against POS 2.0, the sync log gets a channel-tagged entry, and every other
 * screen watching those tags (Orders, Inventory, Activity, Dashboard)
 * refetches without a manual reload.
 */
export function DemoSimulator() {
  const { showToast } = useToast();
  const { data: pool } = useGetInventoryPoolQuery();
  const { data: channels } = useGetChannelsQuery();
  const [sellUnit, { isLoading }] = useSellUnitMutation();

  const items = pool?.rows ?? [];
  const channelList = channels?.rows ?? [];

  const [itemCode, setItemCode] = useState("");
  const [channel, setChannel] = useState("");
  const [message, setMessage] = useState(null);

  const activeItemCode = itemCode || items[0]?.itemCode || "";
  const activeChannel = channel || channelList[0]?.key || "";
  const selectedItem = items.find((i) => i.itemCode === activeItemCode);

  const handleSell = async () => {
    if (!activeItemCode || !activeChannel) return;
    setMessage(null);
    try {
      const result = await sellUnit({ itemCode: activeItemCode, channel: activeChannel }).unwrap();
      if (result.pending) {
        setMessage({ tone: "pending", text: "Unmapped SKU — order dropped into the Pending queue." });
        showToast(`Sold on an unmapped SKU — sent to Pending Orders.`);
      } else {
        setMessage({ tone: "success", text: `Reserved ${result.barcode} against POS 2.0.` });
        showToast(`Sold 1 unit of ${selectedItem?.title ?? activeItemCode} on ${activeChannel}.`);
      }
    } catch (err) {
      const text = formatApiError(err) || "Sale refused.";
      setMessage({ tone: "danger", text });
      showToast(text);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <Zap className="size-3.5" strokeWidth={2} />
          Demo simulator
        </CardDescription>
        <CardTitle className="text-sm font-medium text-foreground">
          Sell a unit on any channel and watch it move
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={activeItemCode} onChange={(e) => setItemCode(e.target.value)} className="min-w-48">
            {items.map((item) => (
              <option key={item.itemCode} value={item.itemCode}>
                {item.title} ({item.available} left)
              </option>
            ))}
          </Select>
          <Select value={activeChannel} onChange={(e) => setChannel(e.target.value)} className="min-w-36">
            {channelList.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button size="sm" onClick={handleSell} disabled={isLoading || !activeItemCode || !activeChannel}>
            {isLoading ? "Selling…" : "Sell a unit"}
          </Button>
        </div>
        {message && (
          <p
            className={
              message.tone === "danger"
                ? "text-sm text-destructive"
                : message.tone === "pending"
                  ? "text-sm text-[color-mix(in_srgb,var(--status-pending)_70%,black)]"
                  : "text-sm text-[color-mix(in_srgb,var(--status-success)_65%,black)]"
            }
          >
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
