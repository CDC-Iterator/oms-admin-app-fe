import { omsApi } from "../omsApiBase.js";

export const reportsApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    // Channel-wise sales, order-status summary, unmapped-SKU list, sync
    // mismatch log — "what you'd actually open on a Monday morning."
    getReports: builder.query({
      query: () => ({ url: "/api/reports/" }),
      providesTags: ["reports", "activity", "pending"],
    }),
  }),
});

export const { useGetReportsQuery } = reportsApi;
