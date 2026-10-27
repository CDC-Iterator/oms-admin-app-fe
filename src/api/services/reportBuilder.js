import { omsApi } from "../omsApiBase.js";
import { unwrapList } from "../unwrapList.js";

// /api/report-builder/ — the field catalog, running a report config, and saved report definitions.
export const reportBuilderApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    getReportCatalog: builder.query({
      query: () => ({ url: "/api/report-builder/catalog/" }),
    }),
    // Not cached: every call is a fresh run of the config.
    runReport: builder.mutation({
      query: (body) => ({ url: "/api/report-builder/run/", method: "POST", body }),
    }),
    // ?resource=, ?search=, ?mine=1, ?page=, ?page_size=
    getReportDefs: builder.query({
      query: (params) => ({ url: "/api/report-builder/reports/", params }),
      transformResponse: unwrapList,
      providesTags: ["reportDefs"],
    }),
    getReportDef: builder.query({
      query: (id) => ({ url: `/api/report-builder/reports/${id}/` }),
      providesTags: (result, error, id) => [{ type: "reportDefs", id }],
    }),
    createReportDef: builder.mutation({
      query: (body) => ({ url: "/api/report-builder/reports/", method: "POST", body }),
      invalidatesTags: ["reportDefs"],
    }),
    updateReportDef: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/api/report-builder/reports/${id}/`, method: "PATCH", body }),
      invalidatesTags: ["reportDefs"],
    }),
    deleteReportDef: builder.mutation({
      query: (id) => ({ url: `/api/report-builder/reports/${id}/`, method: "DELETE" }),
      invalidatesTags: ["reportDefs"],
    }),
  }),
});

export const {
  useGetReportCatalogQuery,
  useRunReportMutation,
  useGetReportDefsQuery,
  useGetReportDefQuery,
  useCreateReportDefMutation,
  useUpdateReportDefMutation,
  useDeleteReportDefMutation,
} = reportBuilderApi;
