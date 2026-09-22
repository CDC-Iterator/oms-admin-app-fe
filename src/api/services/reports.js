import { omsApi } from "../omsApiBase.js";
import { unwrapList } from "../unwrapList.js";

// Four real, separate report endpoints (apps.reports.views) — no unified
// /api/reports/. The two aggregation reports are unpaginated (a handful of
// rows each); unmapped-skus/sync-mismatches are paginated lists.
export const reportsApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    getChannelSalesReport: builder.query({
      query: () => ({ url: "/api/reports/channel-sales/" }),
      providesTags: ["reports"],
    }),
    getOrderStatusSummaryReport: builder.query({
      query: () => ({ url: "/api/reports/order-status-summary/" }),
      providesTags: ["reports"],
    }),
    getUnmappedSkusReport: builder.query({
      query: () => ({ url: "/api/reports/unmapped-skus/" }),
      transformResponse: unwrapList,
      providesTags: ["reports"],
    }),
    getSyncMismatchesReport: builder.query({
      query: () => ({ url: "/api/reports/sync-mismatches/" }),
      transformResponse: unwrapList,
      providesTags: ["reports"],
    }),
  }),
});

export const {
  useGetChannelSalesReportQuery,
  useGetOrderStatusSummaryReportQuery,
  useGetUnmappedSkusReportQuery,
  useGetSyncMismatchesReportQuery,
} = reportsApi;
