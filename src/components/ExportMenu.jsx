import { useEffect, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Link } from "react-router-dom";
import { Download, History, Loader2 } from "lucide-react";

import { StatusBadge } from "./status-badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { useCreateExportMutation, useGetExportsQuery } from "../api/services/exports.js";
import { useExportDownload } from "../hooks/useExportDownload.js";
import { useToast } from "../hooks/useToast.js";
import { EXPORT_ACTIVE, EXPORT_POLL_MS, EXPORT_TONE, formatExportWhen } from "../lib/exports.js";
import { formatApiError } from "../lib/errors.js";

const RECENT = 10;

/**
 * "Export CSV" for a list screen: queues a background export of what the screen currently shows
 * (`params` = its filters, search and ordering), and lists recent exports with their status and a download.
 */
export default function ExportMenu({ resource, params }) {
  const { showToast } = useToast();
  const [polling, setPolling] = useState(false);
  const { data, isError } = useGetExportsQuery({ resource, page_size: RECENT }, { pollingInterval: polling ? EXPORT_POLL_MS : 0 });
  const jobs = data?.rows ?? [];
  const [createExport, { isLoading: starting }] = useCreateExportMutation();
  const { download, downloading } = useExportDownload();

  const active = jobs.filter((j) => EXPORT_ACTIVE.includes(j.status)).length;
  useEffect(() => setPolling(active > 0), [active]);

  const start = async () => {
    try {
      await createExport({ resource, params }).unwrap();
      showToast("Export started — it will show under Exports when it's ready.");
    } catch (err) {
      showToast(formatApiError(err));
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" onClick={start} disabled={starting}>
        {starting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
        Export CSV
      </Button>
      <Popover.Root>
        <Popover.Trigger render={<Button variant="outline" />} aria-label="Recent exports">
          <History className="size-3.5" />
          Exports
          {active > 0 && <Loader2 className="size-3 animate-spin text-muted-foreground" aria-label={`${active} running`} />}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner align="end" sideOffset={6} className="z-50">
            <Popover.Popup className="w-96 max-w-[calc(100vw-2rem)] rounded-lg bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10">
              {jobs.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">{isError ? "Couldn't load exports." : "No exports yet."}</p>
              ) : (
                <ul className="max-h-80 divide-y divide-border overflow-auto">
                  {jobs.map((job) => (
                    <li key={job.id} className="flex items-center gap-2 px-2 py-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono" title={job.filename || undefined}>
                          {job.filename || "Preparing…"}
                        </p>
                        <p className="truncate text-muted-foreground" title={job.error || undefined}>
                          {formatExportWhen(job.created_at)}
                          {job.status === "succeeded" && job.row_count != null && ` · ${job.row_count.toLocaleString("en-IN")} rows`}
                          {job.status === "failed" && ` · ${job.error || "failed"}`}
                        </p>
                      </div>
                      <StatusBadge tone={EXPORT_TONE[job.status] ?? "neutral"} className="status-chip--compact">
                        {job.status}
                      </StatusBadge>
                      {job.can_download && (
                        <Button size="xs" variant="outline" disabled={downloading} onClick={() => download(job)}>
                          Download
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/settings/exports" className="block px-2 pt-2 text-xs text-primary hover:underline">
                All exports →
              </Link>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
