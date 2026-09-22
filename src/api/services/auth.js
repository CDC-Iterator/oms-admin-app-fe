import { createApi } from "@reduxjs/toolkit/query/react";

import baseQuery from "../baseQuery.js";

export const AUTH_API_REDUCER_KEY = "authApi";

export const authApi = createApi({
  reducerPath: AUTH_API_REDUCER_KEY,
  baseQuery,
  tagTypes: ["auth"],
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (body) => ({ url: "/api/auth/login/", method: "POST", body }),
    }),
    refresh: builder.mutation({
      // No body — the refresh token rides the httpOnly cookie automatically.
      query: () => ({ url: "/api/auth/refresh/", method: "POST" }),
    }),
    logout: builder.mutation({
      query: () => ({ url: "/api/auth/logout/", method: "POST" }),
    }),
    getMe: builder.query({
      query: () => ({ url: "/api/auth/me/" }),
      providesTags: ["auth"],
    }),
    changePassword: builder.mutation({
      query: (body) => ({ url: "/api/auth/change-password/", method: "POST", body }),
    }),
  }),
});

export const {
  useLoginMutation,
  useRefreshMutation,
  useLogoutMutation,
  useGetMeQuery,
  useChangePasswordMutation,
} = authApi;
