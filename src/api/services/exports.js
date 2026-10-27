import { omsApi } from "../omsApiBase.js";
import { unwrapList } from "../unwrapList.js";

// /api/exports/ — CSV exports built in the background; GET lists yours, POST queues one.
export const exportsApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    // ?resource=, ?status= (comma list), ?search= (file name), ?page=, ?page_size=
    getExports: builder.query({
      query: (params) => ({ url: "/api/exports/", params }),
      transformResponse: unwrapList,
      providesTags: ["exports"],
    }),
    createExport: builder.mutation({
      query: (body) => ({ url: "/api/exports/", method: "POST", body }),
      invalidatesTags: ["exports"],
    }),
    // A mutation, not a query: the signed file URL expires, so it is never cached.
    getExportUrl: builder.mutation({
      query: (id) => ({ url: `/api/exports/${id}/download/` }),
    }),
  }),
});

export const { useGetExportsQuery, useCreateExportMutation, useGetExportUrlMutation } = exportsApi;
