import { omsApi } from "../omsApiBase.js";
import { unwrapList } from "../unwrapList.js";

export const activityApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    // Every inventory push and order fetch, timestamped and channel-tagged —
    // "the activity log in the demo is the real thing."
    getActivity: builder.query({
      query: (params) => ({ url: "/api/activity/", params }),
      transformResponse: unwrapList,
      providesTags: ["activity"],
    }),
  }),
});

export const { useGetActivityQuery } = activityApi;
