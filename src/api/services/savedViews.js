import { omsApi } from "../omsApiBase.js";

// /api/saved-views/ — named filter sets per screen (resource: orders | fulfillments | inventory | activity).
export const savedViewsApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    getSavedViews: builder.query({
      query: (resource) => ({ url: "/api/saved-views/", params: { resource } }),
      providesTags: ["savedViews"],
    }),
    createSavedView: builder.mutation({
      query: (body) => ({ url: "/api/saved-views/", method: "POST", body }),
      invalidatesTags: ["savedViews"],
    }),
    updateSavedView: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/api/saved-views/${id}/`, method: "PATCH", body }),
      invalidatesTags: ["savedViews"],
    }),
    deleteSavedView: builder.mutation({
      query: (id) => ({ url: `/api/saved-views/${id}/`, method: "DELETE" }),
      invalidatesTags: ["savedViews"],
    }),
  }),
});

export const {
  useGetSavedViewsQuery,
  useCreateSavedViewMutation,
  useUpdateSavedViewMutation,
  useDeleteSavedViewMutation,
} = savedViewsApi;
