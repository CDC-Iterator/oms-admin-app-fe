import { omsApi } from "../omsApiBase.js";

// No list/disconnect API exists on the backend (single-store Shopify only,
// StoreChannel has no DRF viewset) — this is just the real 2-step OAuth
// install ticket flow (apps.channels.oauth_views), admin-only.
export const channelsApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    prepareShopifyInstall: builder.mutation({
      query: (shop) => ({ url: "/api/channels/shopify/install/", method: "POST", body: { shop } }),
    }),
  }),
});

export const { usePrepareShopifyInstallMutation } = channelsApi;
