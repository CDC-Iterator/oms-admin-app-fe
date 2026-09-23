import { omsApi } from "../omsApiBase.js";

export const channelsApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    // Real 2-step OAuth install ticket flow (apps.channels.oauth_views),
    // admin-only — the caller navigates the browser to install_url itself.
    prepareShopifyInstall: builder.mutation({
      query: (shop) => ({ url: "/api/channels/shopify/install/", method: "POST", body: { shop } }),
    }),
    getChannelConnections: builder.query({
      query: () => ({ url: "/api/channels/connections/" }),
      providesTags: ["channelConnections"],
    }),
    connectTataCliq: builder.mutation({
      query: (body) => ({ url: "/api/channels/connections/tatacliq/connect/", method: "POST", body }),
      invalidatesTags: ["channelConnections"],
    }),
    disconnectChannel: builder.mutation({
      query: (name) => ({ url: `/api/channels/connections/${name}/disconnect/`, method: "POST" }),
      invalidatesTags: ["channelConnections"],
    }),
  }),
});

export const {
  usePrepareShopifyInstallMutation,
  useGetChannelConnectionsQuery,
  useConnectTataCliqMutation,
  useDisconnectChannelMutation,
} = channelsApi;
