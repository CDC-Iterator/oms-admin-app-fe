import { useGetShipmentLabelUrlMutation } from "../api/services/fulfilment.js";
import { formatApiError } from "../lib/errors.js";
import { useToast } from "./useToast.js";

// Fetches a fresh signed URL for a shipment's courier label PDF and lets the browser download it.
export function useLabelDownload(orderId) {
  const { showToast } = useToast();
  const [getUrl, { isLoading }] = useGetShipmentLabelUrlMutation();
  const download = async (shipment) => {
    try {
      const { url } = await getUrl({ orderId, shipmentId: shipment.id }).unwrap();
      window.location.assign(url);
    } catch (err) {
      showToast(formatApiError(err));
    }
  };
  return { download, downloading: isLoading };
}
