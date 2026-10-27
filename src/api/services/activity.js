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
    // One row with, for a push to POS, what was sent and what POS answered (`attempts`).
    getActivityRow: builder.query({
      query: (id) => ({ url: `/api/inventory/sync-log/${id}/` }),
    }),
  }),
});

export const { useGetActivityQuery, useGetActivityRowQuery } = activityApi;
