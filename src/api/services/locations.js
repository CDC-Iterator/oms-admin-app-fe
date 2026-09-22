import { omsApi } from "../omsApiBase.js";
import { unwrapList } from "../unwrapList.js";

// Read-only — Location rows are POS-mirrored/seeded data, not something an
// OMS user creates through this API (apps.locations.serializers).
export const locationsApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    getLocations: builder.query({
      query: () => ({ url: "/api/locations/" }),
      transformResponse: unwrapList,
      providesTags: ["locations"],
    }),
  }),
});

export const { useGetLocationsQuery } = locationsApi;
