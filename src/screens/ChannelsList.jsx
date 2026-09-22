import { useState } from "react";
import { Link2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { usePrepareShopifyInstallMutation } from "../api/services/channels.js";
import { formatApiError } from "../lib/errors.js";

const MYSHOPIFY_SUFFIX = ".myshopify.com";

function storeNameFromDomain(domain) {
  const value = (domain ?? "").trim().toLowerCase();
  return value.endsWith(MYSHOPIFY_SUFFIX) ? value.slice(0, -MYSHOPIFY_SUFFIX.length) : value;
}

/**
 * Admin-only. No list/disconnect API exists on the backend (single-store
 * Shopify, no StoreChannel viewset) — this is just the real 2-step OAuth
 * install: POST for a signed, short-lived ticket, then a full-page
 * navigation to it (apps.channels.oauth_views).
 */
export default function ChannelsList() {
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
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Connect the Shopify store this OMS pulls orders from and pushes availability to.
      </p>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            <Link2 className="mr-1.5 inline size-4" /> Connect Shopify
          </CardTitle>
          <CardDescription>You'll be sent through Shopify's install flow.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleConnect}>
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
                  autoFocus
                />
                <span className="flex items-center whitespace-nowrap border-l border-input bg-muted px-2.5 text-sm text-muted-foreground">
                  {MYSHOPIFY_SUFFIX}
                </span>
              </div>
            </div>
            <Button type="submit" disabled={!storeDomain.trim() || isLoading}>
              {isLoading ? "Preparing…" : "Install app"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
