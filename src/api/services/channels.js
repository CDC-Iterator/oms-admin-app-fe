import { omsApi } from "../omsApiBase.js";
import { unwrapList } from "../unwrapList.js";

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
    // A channel can have more than one ChannelLocation now (real
    // per-location push routing) — replaces the old single location_id.
    addChannelLocation: builder.mutation({
      query: ({ channel, external_id, name }) => ({
        url: `/api/channels/connections/${channel}/locations/`,
        method: "POST",
        body: { external_id, name },
      }),
      invalidatesTags: ["channelConnections"],
    }),
    removeChannelLocation: builder.mutation({
      query: ({ channel, id }) => ({
        url: `/api/channels/connections/${channel}/locations/${id}/`,
        method: "DELETE",
      }),
      invalidatesTags: ["channelConnections"],
    }),
    getLocationMappings: builder.query({
      query: () => ({ url: "/api/channels/location-mappings/" }),
      transformResponse: unwrapList,
      providesTags: ["locationMappings"],
    }),
    createLocationMapping: builder.mutation({
      query: (body) => ({ url: "/api/channels/location-mappings/", method: "POST", body }),
      invalidatesTags: ["locationMappings"],
    }),
    deleteLocationMapping: builder.mutation({
      query: (id) => ({ url: `/api/channels/location-mappings/${id}/`, method: "DELETE" }),
      invalidatesTags: ["locationMappings"],
    }),
  }),
});

export const {
  usePrepareShopifyInstallMutation,
  useGetChannelConnectionsQuery,
  useConnectTataCliqMutation,
  useDisconnectChannelMutation,
  useAddChannelLocationMutation,
  useRemoveChannelLocationMutation,
  useGetLocationMappingsQuery,
  useCreateLocationMappingMutation,
  useDeleteLocationMappingMutation,
} = channelsApi;
