import { omsApi } from "../omsApiBase.js";
import { unwrapList } from "../unwrapList.js";

export const ordersApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    getOrders: builder.query({
      query: (params) => ({ url: "/api/orders/", params }),
      transformResponse: unwrapList,
      providesTags: ["orders"],
    }),
    getOrder: builder.query({
      query: (id) => ({ url: `/api/orders/${id}/` }),
      providesTags: ["orders"],
    }),
    // Cancel / return / RTO — each restocks the reserved unit back into the
    // pool and rejoins the same ledger it left (see mockDb.reverseOrder).
    reverseOrder: builder.mutation({
      query: ({ id, mode }) => ({ url: `/api/orders/${id}/reverse/`, method: "POST", body: { mode } }),
      invalidatesTags: ["orders", "inventory", "activity", "stats", "reports"],
    }),
    // The DemoSimulator's "sell a unit on any channel" action — the single
    // mutation that drives the whole real-time sync story.
    sellUnit: builder.mutation({
      query: (body) => ({ url: "/api/demo/sell/", method: "POST", body }),
      invalidatesTags: ["orders", "inventory", "activity", "stats", "pending", "channels", "reports"],
    }),
  }),
});

export const { useGetOrdersQuery, useGetOrderQuery, useReverseOrderMutation, useSellUnitMutation } =
  ordersApi;
