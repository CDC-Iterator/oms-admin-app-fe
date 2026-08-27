import { omsApi } from "../omsApiBase.js";
import { unwrapList } from "../unwrapList.js";

export const channelsApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    getChannels: builder.query({
      query: () => ({ url: "/api/channels/" }),
      transformResponse: unwrapList,
      providesTags: ["channels"],
    }),
    // Single-store: disconnect resets the channel + merchant install state so
    // Connect (a plain redirect into Shopify OAuth, not an API call — see
    // ChannelsList.jsx) starts the exact same flow again from scratch.
    disconnectChannel: builder.mutation({
      query: (id) => ({ url: `/api/channels/${id}/disconnect/`, method: "POST" }),
      invalidatesTags: ["channels"],
    }),
  }),
});

export const { useGetChannelsQuery, useDisconnectChannelMutation } = channelsApi;
