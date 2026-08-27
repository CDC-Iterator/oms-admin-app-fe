import { omsApi } from "../omsApiBase.js";
import { unwrapList } from "../unwrapList.js";

export const inventoryApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    // The item-code pool: one honest available number per item, across every
    // channel, with a per-location breakdown.
    getInventoryPool: builder.query({
      query: () => ({ url: "/api/inventory/pool/" }),
      transformResponse: unwrapList,
      providesTags: ["inventory"],
    }),
    // Expanding a pool row: the individual serials/barcodes under that item
    // code — ownership, purchase price, location — the data allocation ranks.
    getSerials: builder.query({
      query: (itemCode) => ({ url: `/api/inventory/${itemCode}/serials/` }),
      transformResponse: unwrapList,
      providesTags: ["inventory"],
    }),
  }),
});

export const { useGetInventoryPoolQuery, useGetSerialsQuery } = inventoryApi;
