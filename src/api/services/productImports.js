import { omsApi } from "../omsApiBase.js";
import { unwrapList } from "../unwrapList.js";

// /api/product-imports/ — admins upload the POS product master; it imports in the background.
export const productImportsApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    getProductImports: builder.query({
      query: (params) => ({ url: "/api/product-imports/", params }),
      transformResponse: unwrapList,
      providesTags: ["productImports"],
    }),
    getProductImport: builder.query({
      query: (id) => ({ url: `/api/product-imports/${id}/` }),
      providesTags: (r, e, id) => [{ type: "productImports", id }],
    }),
    createProductImport: builder.mutation({
      query: (file) => {
        const body = new FormData();
        body.append("file", file);
        return { url: "/api/product-imports/", method: "POST", body };
      },
      invalidatesTags: ["productImports"],
    }),
    // A mutation, not a query: the signed file URL expires, so it is never cached.
    getProductImportDetailsUrl: builder.mutation({
      query: (id) => ({ url: `/api/product-imports/${id}/details/` }),
    }),
  }),
});

export const {
  useGetProductImportsQuery,
  useGetProductImportQuery,
  useCreateProductImportMutation,
  useGetProductImportDetailsUrlMutation,
} = productImportsApi;
