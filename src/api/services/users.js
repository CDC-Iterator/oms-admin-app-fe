import { omsApi } from "../omsApiBase.js";
import { unwrapList } from "../unwrapList.js";

// /api/users/ — superuser-only (common.permissions.IsSuperAdmin). No
// destroy action on the backend; deactivate via is_active instead.
export const usersApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    // ?search= matches email/first_name/last_name — see UserViewSet.get_queryset.
    getUsers: builder.query({
      query: (params) => ({ url: "/api/users/", params }),
      transformResponse: unwrapList,
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
  }),
});

export const { useGetUsersQuery, useCreateUserMutation, useUpdateUserMutation } = usersApi;
