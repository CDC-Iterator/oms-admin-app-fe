import { omsApi } from "../omsApiBase.js";
import { unwrapList } from "../unwrapList.js";

// Dashboard data (apps.reports.views): channel sales, order status, unmapped SKUs and the two role dashboards.
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
    // Admin only (apps.reports.admin_dashboard): business, fulfilment, integration health, data quality.
    getAdminDashboard: builder.query({
      query: () => ({ url: "/api/reports/admin-dashboard/" }),
      providesTags: ["reports"],
    }),
    // Scoped to the caller's locations (apps.reports.operations_dashboard); refreshed every minute.
    getOperationsDashboard: builder.query({
      query: () => ({ url: "/api/reports/operations-dashboard/" }),
      providesTags: ["reports"],
    }),
  }),
});

export const {
  useGetChannelSalesReportQuery,
  useGetOrderStatusSummaryReportQuery,
  useGetUnmappedSkusReportQuery,
  useGetOperationsDashboardQuery,
  useGetAdminDashboardQuery,
} = reportsApi;
