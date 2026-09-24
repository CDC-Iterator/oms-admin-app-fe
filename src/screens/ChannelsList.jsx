import { useEffect, useState } from "react";
import { Link2, TriangleAlert, Unlink, X } from "lucide-react";

import { ChannelBadge } from "../components/ChannelBadge.jsx";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import {
  useAddChannelLocationMutation,
  useConnectTataCliqMutation,
  useDisconnectChannelMutation,
  useGetChannelConnectionsQuery,
  usePrepareShopifyInstallMutation,
  useRemoveChannelLocationMutation,
} from "../api/services/channels.js";
import { useAuth } from "../hooks/useAuth.js";
import { useToast } from "../hooks/useToast.js";
import { formatApiError } from "../lib/errors.js";

const MYSHOPIFY_SUFFIX = ".myshopify.com";

function storeNameFromDomain(domain) {
  const value = (domain ?? "").trim().toLowerCase();
  return value.endsWith(MYSHOPIFY_SUFFIX) ? value.slice(0, -MYSHOPIFY_SUFFIX.length) : value;
}

// { name: connections/index label } — apps.channels.connection_views'
// _SAFE_EXTRA_KEYS, the only fields a GET ever returns.
const SUMMARY_LABELS = {
  shop_domain: "Store",
  base_url: "Base URL",
  seller_code: "Seller code",
  username: "Username",
  caller_name: "Caller name",
};

const TATACLIQ_FIELDS = [
  { key: "username", label: "Username" },
  { key: "seller_code", label: "Seller code" },
  { key: "caller_name", label: "Caller name" },
  { key: "basic_auth_token", label: "Basic auth token" },
  { key: "base_url", label: "Base URL", placeholder: "https://…" },
  { key: "password", label: "Password", type: "password" },
];

// Real 2-step OAuth install: POST for a signed, short-lived ticket, then a
// full-page navigation to it (apps.channels.oauth_views).
function ShopifyConnectForm() {
  const [storeDomain, setStoreDomain] = useState("");
  const [prepareInstall, { isLoading }] = usePrepareShopifyInstallMutation();
  const [error, setError] = useState(null);

  const handleConnect = async (event) => {
    event.preventDefault();
    setError(null);
    const name = storeNameFromDomain(storeDomain);
    if (!name) return;
    try {
      const { install_url } = await prepareInstall(`${name}${MYSHOPIFY_SUFFIX}`).unwrap();
      window.location.href = install_url;
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  return (
    <form className="space-y-3" onSubmit={handleConnect}>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="storeDomain">Store domain</Label>
        <div className="flex h-8 w-full items-stretch overflow-hidden rounded-lg border border-input bg-transparent focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <Input
            id="storeDomain"
            placeholder="your-store"
            value={storeDomain}
            onChange={(e) => setStoreDomain(storeNameFromDomain(e.target.value))}
            className="h-full flex-1 rounded-none border-0 bg-transparent focus-visible:ring-0"
          />
          <span className="flex items-center whitespace-nowrap border-l border-input bg-muted px-2.5 text-sm text-muted-foreground">
            {MYSHOPIFY_SUFFIX}
          </span>
        </div>
      </div>
      <Button type="submit" size="sm" disabled={!storeDomain.trim() || isLoading}>
        {isLoading ? "Preparing…" : "Install app"}
      </Button>
    </form>
  );
}

// A channel can have more than one location now (Shopify may add a
// warehouse later; TataCliq can have several SlaveIDs) — manual entry for
// each, not a live-fetched picker: no testable store/seller credential
// exists locally to verify a Shopify locations-list query against yet
// (CLAUDE.md's "validate before shipping" convention), so this stays
// plain text until one does.
function ChannelLocationsManager({ connection }) {
  const { showToast } = useToast();
  const [addLocation, { isLoading: adding }] = useAddChannelLocationMutation();
  const [removeLocation] = useRemoveChannelLocationMutation();
  const [externalId, setExternalId] = useState("");
  const [name, setName] = useState("");

  const handleAdd = async (event) => {
    event.preventDefault();
    const trimmed = externalId.trim();
    if (!trimmed) return;
    try {
      await addLocation({ channel: connection.name, external_id: trimmed, name: name.trim() }).unwrap();
      setExternalId("");
      setName("");
    } catch (err) {
      showToast(formatApiError(err));
    }
  };

  const handleRemove = async (id) => {
    try {
      await removeLocation({ channel: connection.name, id }).unwrap();
    } catch (err) {
      showToast(formatApiError(err));
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>Locations (inventory pushes)</Label>
      {connection.locations.length > 0 && (
        <ul className="space-y-1">
          {connection.locations.map((loc) => (
            <li
              key={loc.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1 text-xs"
            >
              <span className="truncate">
                <span className="font-mono">{loc.external_id}</span>
                {loc.name && <span className="text-muted-foreground"> · {loc.name}</span>}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(loc.id)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${loc.external_id}`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="flex gap-1.5" onSubmit={handleAdd}>
        <Input
          value={externalId}
          onChange={(e) => setExternalId(e.target.value)}
          placeholder="Location id"
          className="h-8"
        />
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Label (optional)" className="h-8" />
        <Button type="submit" size="sm" disabled={adding || !externalId.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
}

// PartnerConnect key/value config, not OAuth — TataCliq has no install
// flow, so this just saves credentials straight to StoreChannelCredential.
// Doubles as the "edit" flow for an already-connected TataCliq: prefills
// from `connection.summary` (everything but the two secret fields, which
// the API never returns — those must always be re-entered).
function TataCliqConnectDialog({ open, onOpenChange, onConnected, connection }) {
  const { showToast } = useToast();
  const [connect, { isLoading }] = useConnectTataCliqMutation();
  const [form, setForm] = useState({});
  const [error, setError] = useState(null);
  const isEditing = Boolean(connection?.is_connected);

  useEffect(() => {
    if (open) {
      setForm({
        username: connection?.summary?.username ?? "",
        seller_code: connection?.summary?.seller_code ?? "",
        caller_name: connection?.summary?.caller_name ?? "",
        base_url: connection?.summary?.base_url ?? "",
      });
      setError(null);
    }
  }, [open, connection]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    try {
      await connect(form).unwrap();
      showToast(isEditing ? "TataCliq connection updated." : "TataCliq connected.");
      onConnected();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit TataCliq connection" : "Connect TataCliq"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Basic auth token and password must be re-entered even if unchanged — the saved values never round-trip back to this form."
              : "PartnerConnect credentials from TataCliq's seller onboarding."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {TATACLIQ_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={field.key}>{field.label}</Label>
              <Input
                id={field.key}
                type={field.type ?? "text"}
                placeholder={field.placeholder}
                value={form[field.key] ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                autoComplete="off"
                required={!field.optional}
              />
            </div>
          ))}
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving…" : isEditing ? "Save" : "Connect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DisconnectConfirmDialog({ target, onOpenChange, onDisconnected }) {
  const { showToast } = useToast();
  const [disconnect, { isLoading }] = useDisconnectChannelMutation();

  const handleConfirm = async () => {
    try {
      await disconnect(target.name).unwrap();
      showToast(`${target.label} disconnected.`);
      onDisconnected();
    } catch (err) {
      showToast(formatApiError(err));
    }
  };

  return (
    <AlertDialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect {target?.label}?</AlertDialogTitle>
          <AlertDialogDescription>
            {target?.name === "shopify"
              ? "OMS stops syncing orders and inventory with this store. This does not uninstall the app on Shopify's side — uninstall it from the Shopify admin if you want to fully sever it."
              : "OMS stops syncing with TataCliq and the saved PartnerConnect credentials are cleared. You'll need to re-enter them to reconnect."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
          <Button variant="destructive" onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? "Disconnecting…" : "Disconnect"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ConnectionCard({ connection, canManage, onDisconnect, connectedExtra, children }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            <ChannelBadge channel={connection.name} />
          </CardTitle>
          <StatusBadge tone={connection.is_connected ? "success" : "pending"}>
            {connection.is_connected ? "Connected" : "Not connected"}
          </StatusBadge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {connection.is_connected ? (
          <>
            {Object.keys(connection.summary).length > 0 && (
              <dl className="space-y-1 text-sm">
                {Object.entries(connection.summary).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">{SUMMARY_LABELS[key] ?? key}</dt>
                    <dd className="truncate font-mono text-xs" title={value}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {!connection.push_ready && (
              <p className="flex items-start gap-1.5 text-xs text-[color-mix(in_srgb,var(--status-pending)_80%,black)]">
                <TriangleAlert className="size-3.5 shrink-0 translate-y-0.5" />
                Inventory pushes will fail until a location is set below.
              </p>
            )}
            {canManage && connectedExtra}
            {canManage && (
              <Button variant="outline" size="sm" onClick={onDisconnect}>
                <Unlink className="size-3.5" /> Disconnect
              </Button>
            )}
          </>
        ) : canManage ? (
          children
        ) : (
          <p className="text-sm text-muted-foreground">Not connected.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ChannelsList() {
  const { user } = useAuth();
  // Matches the backend's IsSuperAdmin gate on /api/channels/connections/
  // (superuser or role="admin") — the whole screen, not just writes.
  const canManage = user?.is_superuser || user?.role === "admin";
  const { data, isFetching, error, refetch } = useGetChannelConnectionsQuery();

  const [disconnectTarget, setDisconnectTarget] = useState(null);
  const [tatacliqDialogOpen, setTatacliqDialogOpen] = useState(false);

  const shopify = data?.find((c) => c.name === "shopify");
  const tatacliq = data?.find((c) => c.name === "tatacliq");

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Connect the storefronts this OMS syncs orders and inventory with. Each channel supports one active
        connection at a time.
      </p>

      {error ? (
        <EmptyState
          tone="danger"
          title="Couldn't load channel connections"
          description={`${formatApiError(error)} — try again.`}
          action={
            <Button size="sm" variant="outline" onClick={refetch}>
              Try again
            </Button>
          }
        />
      ) : isFetching && !data ? (
        <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
          {shopify && (
            <ConnectionCard
              connection={shopify}
              canManage={canManage}
              onDisconnect={() => setDisconnectTarget(shopify)}
              connectedExtra={<ChannelLocationsManager connection={shopify} />}
            >
              <ShopifyConnectForm />
            </ConnectionCard>
          )}
          {tatacliq && (
            <ConnectionCard
              connection={tatacliq}
              canManage={canManage}
              onDisconnect={() => setDisconnectTarget(tatacliq)}
              connectedExtra={
                <>
                  <Button variant="outline" size="sm" onClick={() => setTatacliqDialogOpen(true)}>
                    <Link2 className="size-3.5" /> Edit credentials
                  </Button>
                  <ChannelLocationsManager connection={tatacliq} />
                </>
              }
            >
              <Button size="sm" onClick={() => setTatacliqDialogOpen(true)}>
                <Link2 className="size-3.5" /> Connect TataCliq
              </Button>
            </ConnectionCard>
          )}
        </div>
      )}

      <TataCliqConnectDialog
        open={tatacliqDialogOpen}
        onOpenChange={setTatacliqDialogOpen}
        onConnected={() => setTatacliqDialogOpen(false)}
        connection={tatacliq}
      />
      <DisconnectConfirmDialog
        target={disconnectTarget}
        onOpenChange={(open) => !open && setDisconnectTarget(null)}
        onDisconnected={() => setDisconnectTarget(null)}
      />
    </div>
  );
}
