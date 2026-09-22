import { omsApi } from "../omsApiBase.js";
import { unwrapList } from "../unwrapList.js";

// Closest real equivalent to an "activity feed": every inbound/outbound POS
// and channel sync attempt, GET /api/inventory/sync-log/ — optional
// ?direction=/?status=/?channel=/?topic=.
export const activityApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    getActivity: builder.query({
      query: (params) => ({ url: "/api/inventory/sync-log/", params }),
      transformResponse: unwrapList,
      providesTags: ["activity"],
    }),
  }),
});

export const { useGetActivityQuery } = activityApi;
