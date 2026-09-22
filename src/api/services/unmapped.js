import { omsApi } from "../omsApiBase.js";
import { unwrapList } from "../unwrapList.js";

// The durable unresolved-SKU queue — GET /api/orders/unmapped/ lists
// ChannelSkuMapping rows with sku=null; POST .../{id}/map/ resolves one to
// a real ProductVariant (by pk, not item_code) and dispatches
// resolve_unmapped_mapping, which re-suggests units for every order line
// item that was blocked on it.
export const unmappedApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    getUnmapped: builder.query({
      query: () => ({ url: "/api/orders/unmapped/" }),
      transformResponse: unwrapList,
      providesTags: ["unmapped"],
    }),
    mapUnmapped: builder.mutation({
      query: ({ id, sku }) => ({ url: `/api/orders/unmapped/${id}/map/`, method: "POST", body: { sku } }),
      invalidatesTags: ["unmapped", "orders", "inventory", "reports"],
    }),
  }),
});

export const { useGetUnmappedQuery, useMapUnmappedMutation } = unmappedApi;
