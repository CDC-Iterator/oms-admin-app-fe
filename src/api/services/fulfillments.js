import { createApi } from "@reduxjs/toolkit/query/react";

import baseQuery from "../baseQuery.js";
import { unwrapList } from "../unwrapList.js";

export const FULFILLMENTS_API_REDUCER_KEY = "fulfillmentsApi";

export const fulfillmentsApi = createApi({
  reducerPath: FULFILLMENTS_API_REDUCER_KEY,
  baseQuery,
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
