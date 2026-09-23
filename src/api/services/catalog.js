import { omsApi } from "../omsApiBase.js";
import { unwrapList } from "../unwrapList.js";

// ProductVariant rows are POS-mirrored and read-only here — the only write
// this app makes into apps.catalog is the channel mapping upsert below.
export const catalogApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    getProducts: builder.query({
      // params: page, search, unmapped, item_code, active.
      query: (params) => ({ url: "/api/skus/", params }),
      transformResponse: unwrapList,
      providesTags: ["catalog"],
    }),
    // Admin-only on the backend — creates/updates the ChannelSkuMapping row
    // for (variantId, channel), upserting on that pair rather than on
    // ChannelSkuMapping's own (channel, external_sku) uniqueness.
    upsertChannelMapping: builder.mutation({
      query: ({ variantId, channel, external_sku, external_variant_id }) => ({
        url: `/api/skus/${variantId}/channel-mappings/`,
        method: "POST",
        body: { channel, external_sku, external_variant_id },
      }),
      invalidatesTags: ["catalog", "channelProducts"],
    }),
    // Clears sku on the (variantId, channel) mapping row — keeps the row
    // and its synced channel_title/price/image_url, per ChannelSkuMapping's
    // own "sku=None means unmapped" convention.
    removeChannelMapping: builder.mutation({
      query: ({ variantId, channel }) => ({
        url: `/api/skus/${variantId}/channel-mappings/`,
        method: "DELETE",
        params: { channel },
      }),
      invalidatesTags: ["catalog", "channelProducts"],
    }),
  }),
});

export const { useGetProductsQuery, useUpsertChannelMappingMutation, useRemoveChannelMappingMutation } = catalogApi;
