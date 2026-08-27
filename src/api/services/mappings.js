import { omsApi } from "../omsApiBase.js";
import { unwrapList } from "../unwrapList.js";

export const mappingsApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    // Channel SKU / ID → POS 2.0 item code. Item code is the universal key —
    // this table is what lets an order from any channel resolve to it.
    getMappings: builder.query({
      query: (params) => ({ url: "/api/mappings/", params }),
      transformResponse: unwrapList,
      providesTags: ["mappings"],
    }),
    createMapping: builder.mutation({
      query: (body) => ({ url: "/api/mappings/", method: "POST", body }),
      invalidatesTags: ["mappings", "pending", "reports"],
    }),
    updateMapping: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/api/mappings/${id}/`, method: "PATCH", body }),
      invalidatesTags: ["mappings", "pending", "reports"],
    }),
    deleteMapping: builder.mutation({
      query: (id) => ({ url: `/api/mappings/${id}/`, method: "DELETE" }),
      invalidatesTags: ["mappings", "pending", "reports"],
    }),
  }),
});

export const {
  useGetMappingsQuery,
  useCreateMappingMutation,
  useUpdateMappingMutation,
  useDeleteMappingMutation,
} = mappingsApi;
