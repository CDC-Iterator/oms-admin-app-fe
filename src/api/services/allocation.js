import { omsApi } from "../omsApiBase.js";

/**
 * PROPOSED — EXTRA SCOPE. Serial-level allocation rules (ownership →
 * purchase price → warehouse/store → zone) are not in the current ₹3.5L OMS
 * proposal, which leaves allocation/reservation owned by POS 2.0. Wired here
 * so the idea Rishab Jain raised (WhatsApp) is demoable, clearly flagged in
 * every screen it touches (see ScopeBanner.jsx).
 */
export const allocationApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllocationRules: builder.query({
      query: () => ({ url: "/api/allocation/rules/" }),
      providesTags: ["allocation"],
    }),
    saveAllocationRules: builder.mutation({
      query: (rules) => ({ url: "/api/allocation/rules/", method: "PUT", body: { rules } }),
      invalidatesTags: ["allocation"],
    }),
    getAllocationPreview: builder.query({
      query: (itemCode) => ({ url: `/api/allocation/preview/${itemCode}/` }),
      providesTags: ["allocation", "inventory"],
    }),
  }),
});

export const {
  useGetAllocationRulesQuery,
  useSaveAllocationRulesMutation,
  useGetAllocationPreviewQuery,
} = allocationApi;
