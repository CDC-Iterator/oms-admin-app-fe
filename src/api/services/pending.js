import { omsApi } from "../omsApiBase.js";
import { unwrapList } from "../unwrapList.js";

export const pendingApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    // Orders carrying an item code with no mapping yet — held here rather
    // than lost, per the proposal's signature safety mechanism.
    getPending: builder.query({
      query: () => ({ url: "/api/pending/" }),
      transformResponse: unwrapList,
      providesTags: ["pending"],
    }),
    // Map the channel SKU to a POS item code — the order rejoins the normal
    // flow (reserved) and leaves the queue.
    mapPending: builder.mutation({
      query: ({ id, itemCode }) => ({ url: `/api/pending/${id}/map/`, method: "POST", body: { itemCode } }),
      invalidatesTags: ["pending", "orders", "inventory", "mappings", "activity", "stats", "reports"],
    }),
  }),
});

export const { useGetPendingQuery, useMapPendingMutation } = pendingApi;
