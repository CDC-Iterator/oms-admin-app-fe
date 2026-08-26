import { createApi } from "@reduxjs/toolkit/query/react";

import axiosBaseQuery from "../axiosBaseQuery.js";
import { unwrapList } from "../unwrapList.js";

export const USERS_API_REDUCER_KEY = "usersApi";

export const usersApi = createApi({
  reducerPath: USERS_API_REDUCER_KEY,
  baseQuery: axiosBaseQuery,
  tagTypes: ["users"],
  endpoints: (builder) => ({
    getUsers: builder.query({
      query: (params) => ({ url: "/api/users/", params }),
      transformResponse: unwrapList,
      providesTags: ["users"],
    }),
    getUser: builder.query({
      query: (id) => ({ url: `/api/users/${id}/` }),
      providesTags: ["users"],
    }),
    createUser: builder.mutation({
      query: (body) => ({ url: "/api/users/", method: "POST", body }),
      invalidatesTags: ["users"],
    }),
    updateUser: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/api/users/${id}/`, method: "PATCH", body }),
      invalidatesTags: ["users"],
    }),
    deleteUser: builder.mutation({
      query: (id) => ({ url: `/api/users/${id}/`, method: "DELETE" }),
      invalidatesTags: ["users"],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetUserQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
} = usersApi;
