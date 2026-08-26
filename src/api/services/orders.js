import { createApi } from "@reduxjs/toolkit/query/react";

import axiosBaseQuery from "../axiosBaseQuery.js";
import { unwrapList } from "../unwrapList.js";

export const ORDERS_API_REDUCER_KEY = "ordersApi";

export const ordersApi = createApi({
  reducerPath: ORDERS_API_REDUCER_KEY,
  baseQuery: axiosBaseQuery,
  tagTypes: ["orders"],
  endpoints: (builder) => ({
    getOrders: builder.query({
      query: (params) => ({ url: "/api/orders/", params }),
      transformResponse: unwrapList,
      providesTags: ["orders"],
    }),
  }),
});

export const { useGetOrdersQuery } = ordersApi;
