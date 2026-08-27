import { omsApi } from "../omsApiBase.js";

export const statsApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    // Dashboard control-tower numbers: oversell exposure, unmapped count,
    // sync health, channels in sync, channel sales, recent activity feed.
    getStats: builder.query({
      query: () => ({ url: "/api/stats/" }),
      providesTags: ["stats"],
    }),
  }),
});

export const { useGetStatsQuery } = statsApi;
