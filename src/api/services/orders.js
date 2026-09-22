import { omsApi } from "../omsApiBase.js";
import { unwrapList } from "../unwrapList.js";

// /api/orders/{id}/events/ event_type choices — must match
// apps.orders.tasks._EVENT_TYPE_MAP on the backend exactly.
export const ORDER_EVENT_TYPES = ["cancelled", "returned", "rto"];

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
    // Count per Order.Status (every status, even 0), honoring ?channel=/
    // ?search= but never ?status= itself — backs the Orders screen's tabs.
    getOrderStatusSummary: builder.query({
      query: (params) => ({ url: "/api/orders/status-summary/", params }),
      providesTags: ["orders"],
    }),
    // Cancel / return / RTO — dispatches apps.orders.tasks.handle_order_event
    // asynchronously (202), which restocks the reserved unit back into the
    // ledger it left.
    postOrderEvent: builder.mutation({
      query: ({ id, event_type }) => ({ url: `/api/orders/${id}/events/`, method: "POST", body: { event_type } }),
      invalidatesTags: ["orders", "inventory"],
    }),
    getSuggestedUnit: builder.query({
      query: ({ orderId, lineItemId }) => ({
        url: `/api/orders/${orderId}/line-items/${lineItemId}/suggested-unit/`,
      }),
      providesTags: ["orders"],
    }),
    refreshSuggestedUnit: builder.mutation({
      query: ({ orderId, lineItemId }) => ({
        url: `/api/orders/${orderId}/line-items/${lineItemId}/suggested-unit/`,
        method: "POST",
      }),
      invalidatesTags: ["orders"],
    }),
  }),
});

export const {
  useGetOrdersQuery,
  useGetOrderQuery,
  useGetOrderStatusSummaryQuery,
  usePostOrderEventMutation,
  useGetSuggestedUnitQuery,
  useRefreshSuggestedUnitMutation,
} = ordersApi;
