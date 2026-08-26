import { createApi } from "@reduxjs/toolkit/query/react";

import axiosBaseQuery from "../axiosBaseQuery.js";

export const STATS_API_REDUCER_KEY = "statsApi";

// Backend returns { orders, inventory, fulfillments, customers } as plain
// counts (see shopify/merchant_api/views.py StatsView) — not a paginated
// list, so no unwrapList transform needed here.
export const statsApi = createApi({
  reducerPath: STATS_API_REDUCER_KEY,
  baseQuery: axiosBaseQuery,
  tagTypes: ["stats"],
  endpoints: (builder) => ({
    getStats: builder.query({
      query: () => ({ url: "/api/stats/" }),
      providesTags: ["stats"],
    }),
  }),
});

export const { useGetStatsQuery } = statsApi;
