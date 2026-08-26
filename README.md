# CDC OMS — Admin (React)

React admin with read-only listing screens (Dashboard, Orders, Inventory,
Fulfillments, Customers) that display data as it arrives via Shopify
webhooks, plus the `shopify.app.toml` that registers the app with Shopify.

## Setup

```bash
npm install
npm run dev
```

The dev server proxies nothing — it calls the backend directly at
`VITE_API_BASE_URL` (see `.env`, gitignored — not committed). Run the
backend (`../backend`) first.

`VITE_DEV_SHOP_DOMAIN` (optional, also in `.env`) sends an `X-Shop-Domain`
header on every request, matching the backend's `ALLOW_DEV_AUTH` dev auth.
Without it, every list is empty because no merchant can be resolved.

## Registering with Shopify

`shopify.app.toml` and `shopify.web.toml` declare the app to Shopify:

1. Paste the real `client_id` into `shopify.app.toml` once the app exists in
   the Partner Dashboard.
2. Replace the placeholder hosts (`cdc-oms-admin.example.com`,
   `cdc-oms-api.example.com`) with the real frontend/backend URLs.
3. Keep `access_scopes.scopes` in sync with the backend's `SHOPIFY_SCOPES`
   env var.
4. Validate: `shopify app config validate --json` (Shopify CLI). Note this
   command needs a real `client_id` linked to an authenticated Partner
   Dashboard org to fully validate — it can't check the schema fully offline
   with a placeholder `client_id`. The TOML syntax itself has already been
   confirmed valid (parses cleanly, expected top-level keys present).

## Screens

| Screen | Reads | Shows |
|---|---|---|
| Dashboard | — | Links into each list |
| Orders | `GET /api/orders/` | order #, customer, total, status, date |
| Inventory | `GET /api/inventory/` | SKU/item, location, available qty, updated |
| Fulfillments | `GET /api/fulfillments/` | id, order, status, tracking, date |
| Customers | `GET /api/customers/` | name, email, orders count, total spent, date |
