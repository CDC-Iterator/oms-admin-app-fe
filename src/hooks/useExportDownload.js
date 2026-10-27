import { useGetExportUrlMutation } from "../api/services/exports.js";
import { formatApiError } from "../lib/errors.js";
import { useToast } from "./useToast.js";

// Fetches a fresh signed URL for an export and lets the browser download it.
export function useExportDownload() {
  const { showToast } = useToast();
  const [getUrl, { isLoading }] = useGetExportUrlMutation();
  const download = async (job) => {
    try {
      const { url } = await getUrl(job.id).unwrap();
      window.location.assign(url);
    } catch (err) {
      showToast(formatApiError(err));
    }
  };
  return { download, downloading: isLoading };
}
