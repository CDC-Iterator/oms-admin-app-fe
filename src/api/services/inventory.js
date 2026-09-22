import { omsApi } from "../omsApiBase.js";
import { unwrapList } from "../unwrapList.js";

export const inventoryApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    // One (sku, location) row per pair — GET /api/inventory/ledger/,
    // optional ?sku=<item_code>/?location=<code>/?location_id=/?search=.
    getInventoryLedger: builder.query({
      query: (params) => ({ url: "/api/inventory/ledger/", params }),
      transformResponse: unwrapList,
      providesTags: ["inventory"],
    }),
    // Row count per location (same scoping/?search= as the list above) —
    // backs the Inventory screen's dynamic per-location tabs.
    getInventoryLocationSummary: builder.query({
      query: (params) => ({ url: "/api/inventory/ledger/location-summary/", params }),
      providesTags: ["inventory"],
    }),
    // Individual barcode-level rows — GET /api/inventory/units/?sku=
    // (required in practice)/?location_id= (optional). Backs the Inventory
    // screen's per-SKU "Units" drawer.
    getInventoryUnits: builder.query({
      query: (params) => ({ url: "/api/inventory/units/", params }),
      transformResponse: unwrapList,
      providesTags: ["inventory"],
    }),
  }),
});

export const { useGetInventoryLedgerQuery, useGetInventoryLocationSummaryQuery, useGetInventoryUnitsQuery } =
  inventoryApi;
