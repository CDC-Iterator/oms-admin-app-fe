import { createApi } from "@reduxjs/toolkit/query/react";

import baseQuery from "./baseQuery.js";

export const OMS_API_REDUCER_KEY = "omsApi";

/**
 * The single RTK Query slice backing every Phase 1 OMS screen (orders,
 * inventory pool, mappings, pending queue, channels, locations, activity,
 * reports, stats, allocation). One reducerPath on purpose: these domains are
 * genuinely interrelated — selling one unit touches orders, inventory,
 * activity, stats and possibly pending, all at once — and RTK Query tag
 * invalidation only crosses endpoints within the same api instance, not
 * across separate createApi slices. Each domain still gets its own file under
 * services/ (see orders.js, inventory.js, ...), calling
 * `omsApi.injectEndpoints({...})` rather than declaring a new createApi —
 * same "one file per domain" shape as the Shopify-mirror slices, just sharing
 * one cache.
 */
export const omsApi = createApi({
  reducerPath: OMS_API_REDUCER_KEY,
  baseQuery,
  tagTypes: [
    "orders",
    "inventory",
    "mappings",
    "pending",
    "channels",
    "locations",
    "activity",
    "reports",
    "stats",
    "allocation",
  ],
  endpoints: () => ({}),
});
