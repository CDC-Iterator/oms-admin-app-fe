import { omsApi } from "../omsApiBase.js";
import { unwrapList } from "../unwrapList.js";

export const locationsApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    getLocations: builder.query({
      query: () => ({ url: "/api/locations/" }),
      transformResponse: unwrapList,
      providesTags: ["locations"],
    }),
    createLocation: builder.mutation({
      query: (body) => ({ url: "/api/locations/", method: "POST", body }),
      invalidatesTags: ["locations"],
    }),
    updateLocation: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/api/locations/${id}/`, method: "PATCH", body }),
      invalidatesTags: ["locations"],
    }),
    deleteLocation: builder.mutation({
      query: (id) => ({ url: `/api/locations/${id}/`, method: "DELETE" }),
      invalidatesTags: ["locations"],
    }),
  }),
});

export const {
  useGetLocationsQuery,
  useCreateLocationMutation,
  useUpdateLocationMutation,
  useDeleteLocationMutation,
} = locationsApi;
