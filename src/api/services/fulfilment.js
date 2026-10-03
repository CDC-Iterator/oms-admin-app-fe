import { omsApi } from "../omsApiBase.js";

// apps.fulfilment — Shipment/ShipmentLineItem, mounted under /api/orders/.
// All four couriers (shipway/shipdelight/quicklee/manual) have real backend
// connectors now (CDC-78/79/80) — createShipment books an integrated
// courier (202, async — the Shipment row lands once the courier confirms),
// createManualShipment is the synchronous carrier-outside-the-three path.
export const fulfilmentApi = omsApi.injectEndpoints({
  endpoints: (builder) => ({
    getShipments: builder.query({
      query: (orderId) => ({ url: `/api/orders/${orderId}/shipments/` }),
      providesTags: (result, error, orderId) => [{ type: "shipments", id: orderId }],
    }),
    createShipment: builder.mutation({
      query: ({ orderId, courier, line_items, weight_kg, length_cm, breadth_cm, height_cm }) => ({
        url: `/api/orders/${orderId}/shipments/`,
        method: "POST",
        body: { courier, line_items, weight_kg, length_cm, breadth_cm, height_cm },
      }),
      // "orders" too — the order's own line_items[].shipments summary
      // (grouping, coarse status/tone in the Lines card) comes from
      // getOrder, a separate query this doesn't otherwise touch.
      invalidatesTags: (result, error, { orderId }) => [{ type: "shipments", id: orderId }, "orders"],
    }),
    createManualShipment: builder.mutation({
      query: ({ orderId, awb_number, carrier_name, tracking_url, line_items }) => ({
        url: `/api/orders/${orderId}/shipments/manual/`,
        method: "POST",
        body: { awb_number, carrier_name, tracking_url, line_items },
      }),
      invalidatesTags: (result, error, { orderId }) => [{ type: "shipments", id: orderId }, "orders"],
    }),
    // Edits an already-booked shipment's carrier details/status — courier
    // and line items are fixed at creation, not editable here.
    updateShipment: builder.mutation({
      query: ({ orderId, shipmentId, ...body }) => ({
        url: `/api/orders/${orderId}/shipments/${shipmentId}/`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (result, error, { orderId }) => [{ type: "shipments", id: orderId }, "orders"],
    }),
  }),
});

export const {
  useGetShipmentsQuery,
  useCreateShipmentMutation,
  useCreateManualShipmentMutation,
  useUpdateShipmentMutation,
} = fulfilmentApi;
