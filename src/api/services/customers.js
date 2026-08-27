import { createApi } from "@reduxjs/toolkit/query/react";

import baseQuery from "../baseQuery.js";
import { unwrapList } from "../unwrapList.js";

export const CUSTOMERS_API_REDUCER_KEY = "customersApi";

export const customersApi = createApi({
  reducerPath: CUSTOMERS_API_REDUCER_KEY,
  baseQuery,
  tagTypes: ["customers"],
  endpoints: (builder) => ({
    getCustomers: builder.query({
      query: (params) => ({ url: "/api/customers/", params }),
      transformResponse: unwrapList,
      providesTags: ["customers"],
    }),
  }),
});

export const { useGetCustomersQuery } = customersApi;
