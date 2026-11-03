import { useDownloadShipmentLabelsMutation, useGetShipmentLabelUrlMutation } from "../api/services/fulfilment.js";
import { formatApiError } from "../lib/errors.js";
import { useToast } from "./useToast.js";

// Fetches a fresh signed URL for a shipment's courier label PDF and lets the browser download it.
export function useLabelDownload(defaultOrderId) {
  const { showToast } = useToast();
  const [getUrl, { isLoading }] = useGetShipmentLabelUrlMutation();
  const download = async (shipment, orderId = defaultOrderId) => {
    try {
      const { url } = await getUrl({ orderId, shipmentId: shipment.id }).unwrap();
      window.location.assign(url);
    } catch (err) {
      showToast(formatApiError(err));
    }
  };
  return { download, downloading: isLoading };
}

// One merged PDF for many shipments; resolves true when a file was handed to the browser.
export function useBulkLabelDownload() {
  const { showToast } = useToast();
  const [merge, { isLoading }] = useDownloadShipmentLabelsMutation();
  const download = async (shipmentIds) => {
    try {
      const { url, count, skipped } = await merge(shipmentIds).unwrap();
      window.location.assign(url);
      const missed = skipped?.length ? ` ${skipped.length} had no label: ${skipped.map((s) => s.awb_number || `#${s.shipment_id}`).join(", ")}.` : "";
      showToast(`Downloading ${count} label${count === 1 ? "" : "s"}.${missed}`);
      return true;
    } catch (err) {
      showToast(formatApiError(err));
      return false;
    }
  };
  return { download, downloading: isLoading };
}
