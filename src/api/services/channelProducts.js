import { omsApi } from "../omsApiBase.js";
import { unwrapList } from "../unwrapList.js";

// /api/channels/products/ — the full channel catalog mirror
// (ChannelProduct/ChannelProductVariant), mapped or not. Distinct from
// unmapped.js's /api/orders/unmapped/, which is order-triggered only.
export const channelProductsApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    getChannelProducts: builder.query({
      // params: page, search, channel, mapped ("true"/"false").
      query: (params) => ({ url: "/api/channels/products/", params }),
      transformResponse: unwrapList,
      providesTags: ["channelProducts"],
    }),
    // Admin-only on the backend — dispatches sync_channel_products async (202).
    syncChannelProducts: builder.mutation({
      query: () => ({ url: "/api/channels/products/sync/", method: "POST" }),
      invalidatesTags: ["channelProducts"],
    }),
  }),
});

export const { useGetChannelProductsQuery, useSyncChannelProductsMutation } = channelProductsApi;
