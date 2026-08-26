import { createApi } from "@reduxjs/toolkit/query/react";

import axiosBaseQuery from "../axiosBaseQuery.js";
import { unwrapList } from "../unwrapList.js";

export const FULFILLMENTS_API_REDUCER_KEY = "fulfillmentsApi";

export const fulfillmentsApi = createApi({
  reducerPath: FULFILLMENTS_API_REDUCER_KEY,
  baseQuery: axiosBaseQuery,
  tagTypes: ["fulfillments"],
  endpoints: (builder) => ({
    getFulfillments: builder.query({
      query: (params) => ({ url: "/api/fulfillments/", params }),
      transformResponse: unwrapList,
      providesTags: ["fulfillments"],
    }),
  }),
});

export const { useGetFulfillmentsQuery } = fulfillmentsApi;
