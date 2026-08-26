import { createApi } from "@reduxjs/toolkit/query/react";

import axiosBaseQuery from "../axiosBaseQuery.js";

export const AUTH_API_REDUCER_KEY = "authApi";

export const authApi = createApi({
  reducerPath: AUTH_API_REDUCER_KEY,
  baseQuery: axiosBaseQuery,
  tagTypes: ["auth"],
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (body) => ({ url: "/api/auth/login/", method: "POST", body }),
    }),
    refresh: builder.mutation({
      query: (body) => ({ url: "/api/auth/refresh/", method: "POST", body }),
    }),
    logout: builder.mutation({
      query: (body) => ({ url: "/api/auth/logout/", method: "POST", body }),
    }),
    getMe: builder.query({
      query: () => ({ url: "/api/auth/me/" }),
      providesTags: ["auth"],
    }),
  }),
});

export const {
  useLoginMutation,
  useRefreshMutation,
  useLogoutMutation,
  useGetMeQuery,
} = authApi;
