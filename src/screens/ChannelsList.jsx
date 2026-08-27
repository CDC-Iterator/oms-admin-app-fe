import { useState } from "react";
import { Link2, Radio, Unlink } from "lucide-react";

import { EmptyState } from "../components/empty-state.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert.jsx";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { useDisconnectChannelMutation, useGetChannelsQuery } from "../api/services/channels.js";
import { useToast } from "../hooks/useToast.js";
import { formatApiError } from "../lib/errors.js";
import { channelTone } from "../lib/status.js";

const MYSHOPIFY_SUFFIX = ".myshopify.com";

/** Strip a trailing ".myshopify.com" so the input only ever holds the store name. */
function storeNameFromDomain(domain) {
  const value = (domain ?? "").trim().toLowerCase();
  return value.endsWith(MYSHOPIFY_SUFFIX) ? value.slice(0, -MYSHOPIFY_SUFFIX.length) : value;
}

/**
 * Single-store: exactly one channel, connected to exactly one Shopify store
 * at a time. Two actions only — Connect (redirect into the real OAuth
 * install flow) or Disconnect (clears local connection state so the same
 * flow can start again, on this store or a different one).
 */
export default function ChannelsList() {
  const { showToast } = useToast();
  const { data, isFetching, error } = useGetChannelsQuery();
  const [disconnectChannel, { isLoading: isDisconnecting }] = useDisconnectChannelMutation();

  const [connectTarget, setConnectTarget] = useState(null);
  const [storeDomain, setStoreDomain] = useState("");
  const [disconnectTarget, setDisconnectTarget] = useState(null);
  const [disconnectError, setDisconnectError] = useState(null);

  const openConnect = (channel) => {
    setStoreDomain("");
    setConnectTarget(channel);
  };

  // Kicks off the real Shopify OAuth install: a plain browser navigation (not
  // an API call) so the backend's redirect chain — install → Shopify consent
  // → callback → back here — plays out as full page loads. Backend then pulls
  // the store's content in and marks this channel connected.
  const handleConnect = (event) => {
    event.preventDefault();
    const name = storeNameFromDomain(storeDomain);
    if (!name) return;
    const shop = `${name}${MYSHOPIFY_SUFFIX}`;
    const base = import.meta.env.VITE_API_BASE_URL;
    window.location.href = `${base}/shopify/cdc-oms/install/?shop=${encodeURIComponent(shop)}`;
  };

  const handleDisconnect = async () => {
    setDisconnectError(null);
    try {
      await disconnectChannel(disconnectTarget.id).unwrap();
      showToast(`${disconnectTarget.storeDomain || disconnectTarget.name} disconnected.`);
      setDisconnectTarget(null);
    } catch (err) {
      setDisconnectError(formatApiError(err));
    }
  };

  const channels = data?.rows ?? [];

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        The one sales channel connected to CDC's stock — which store it's talking to, and when it
        last synced.
      </p>

      {error ? (
        <EmptyState tone="danger" title="Couldn't load channels" description={formatApiError(error)} />
      ) : isFetching ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : channels.length === 0 ? (
        <EmptyState icon={Radio} title="No channels configured" description="Connect a sales channel to see it here." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((c) => {
            const connected = c.status === "connected" && Boolean(c.storeDomain);
            return (
              <Card key={c.id}>
                <CardHeader className="flex-row items-start justify-between gap-2">
                  <CardTitle className="text-sm font-medium">{c.name}</CardTitle>
                  <StatusBadge tone={channelTone(connected ? "connected" : "disconnected")}>
                    {connected ? "Connected" : "Not connected"}
                  </StatusBadge>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {connected ? (
                    <>
                      <p className="font-mono text-xs">{c.storeDomain}</p>
                      <p className="text-xs text-muted-foreground">
                        Last sync {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleTimeString() : "—"}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">No store connected yet.</p>
                  )}
                  {c.filterRule && <p className="text-muted-foreground">{c.filterRule}</p>}
                  <p className="font-mono text-xs">{c.mappedItems} SKUs mapped</p>
                  {connected ? (
                    <Button size="sm" variant="outline" onClick={() => setDisconnectTarget(c)}>
                      <Unlink className="size-3.5" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => openConnect(c)}>
                      <Link2 className="size-3.5" />
                      Connect
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={Boolean(connectTarget)} onOpenChange={(open) => !open && setConnectTarget(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Connect {connectTarget?.name}</SheetTitle>
            <SheetDescription>
              Enter the store to install on. You'll be sent through Shopify's install flow — content
              pulls into the backend automatically once it completes.
            </SheetDescription>
          </SheetHeader>
          <form id="connect-form" className="flex flex-1 flex-col gap-4 px-4" onSubmit={handleConnect}>
            <div className="space-y-1.5">
              <Label htmlFor="storeDomain">Store domain</Label>
              <div className="flex h-8 w-full items-stretch overflow-hidden rounded-lg border border-input bg-transparent focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                <Input
                  id="storeDomain"
                  placeholder="your-store"
                  value={storeDomain}
                  onChange={(e) => setStoreDomain(storeNameFromDomain(e.target.value))}
                  className="h-full flex-1 rounded-none border-0 bg-transparent focus-visible:ring-0"
                  autoFocus
                />
                <span className="flex items-center whitespace-nowrap border-l border-input bg-muted px-2.5 text-sm text-muted-foreground">
                  {MYSHOPIFY_SUFFIX}
                </span>
              </div>
            </div>
          </form>
          <SheetFooter>
            <Button type="submit" form="connect-form" disabled={!storeDomain.trim()}>
              Install app
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(disconnectTarget)} onOpenChange={(open) => !open && setDisconnectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {disconnectTarget?.storeDomain}?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll need to reinstall to reconnect. Existing orders and inventory aren't affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {disconnectError && (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{disconnectError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
            <Button variant="destructive" onClick={handleDisconnect} disabled={isDisconnecting}>
              {isDisconnecting ? "Disconnecting…" : "Disconnect"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
