import { omsApi } from "../omsApiBase.js";

// apps.fulfilment — Shipment/ShipmentLineItem, mounted under /api/orders/.
// courier="manual" is the only path with a real connector today; the three
// integrated couriers (shipway/shipdelight/quicklee) are stubs on the backend.
export const fulfilmentApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    getShipments: builder.query({
      query: (orderId) => ({ url: `/api/orders/${orderId}/shipments/` }),
      providesTags: (result, error, orderId) => [{ type: "shipments", id: orderId }],
    }),
    createShipment: builder.mutation({
      query: ({ orderId, courier, line_items }) => ({
        url: `/api/orders/${orderId}/shipments/`,
        method: "POST",
        body: { courier, line_items },
      }),
      invalidatesTags: (result, error, { orderId }) => [{ type: "shipments", id: orderId }],
    }),
    createManualShipment: builder.mutation({
      query: ({ orderId, awb_number, carrier_name, tracking_url, line_items }) => ({
        url: `/api/orders/${orderId}/shipments/manual/`,
        method: "POST",
        body: { awb_number, carrier_name, tracking_url, line_items },
      }),
      invalidatesTags: (result, error, { orderId }) => [{ type: "shipments", id: orderId }],
    }),
  }),
});

export const { useGetShipmentsQuery, useCreateShipmentMutation, useCreateManualShipmentMutation } = fulfilmentApi;
