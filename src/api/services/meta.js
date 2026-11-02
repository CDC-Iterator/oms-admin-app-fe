import { omsApi } from "../omsApiBase.js";

// What a list endpoint accepts (filters, sorts, search), GET /api/meta/resources/<key>/ — apps.list_meta.
export const metaApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    getResourceMeta: builder.query({
      query: (key) => ({ url: `/api/meta/resources/${key}/` }),
    }),
  }),
});

export const { useGetResourceMetaQuery } = metaApi;
