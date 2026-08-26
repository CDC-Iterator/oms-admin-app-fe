import { createApi } from "@reduxjs/toolkit/query/react";

import axiosBaseQuery from "../axiosBaseQuery.js";
import { unwrapList } from "../unwrapList.js";

export const INVENTORY_API_REDUCER_KEY = "inventoryApi";

export const inventoryApi = createApi({
  reducerPath: INVENTORY_API_REDUCER_KEY,
  baseQuery: axiosBaseQuery,
  tagTypes: ["inventory"],
  endpoints: (builder) => ({
    getInventoryItems: builder.query({
      query: (params) => ({ url: "/api/inventory/", params }),
      transformResponse: unwrapList,
      providesTags: ["inventory"],
    }),
  }),
});

export const { useGetInventoryItemsQuery } = inventoryApi;
