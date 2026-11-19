import { useRef, useState } from "react";
import { FileDown, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";

import { StatusBadge } from "../components/status-badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card, CardContent } from "@/components/ui/card.jsx";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import {
  useCreateProductImportMutation,
  useGetProductImportDetailsUrlMutation,
  useGetProductImportQuery,
  useGetProductImportsQuery,
} from "../api/services/productImports.js";
import { useToast } from "../hooks/useToast.js";
import { formatApiError } from "../lib/errors.js";
import { EXPORT_TONE, exportDuration, formatExportWhen } from "../lib/exports.js";

const POLL_MS = 2000;
const ACTIVE = ["queued", "running"];
const COLUMNS_HELP = "Item code, DIVISION, SECTION, DEPARTMENT, STYLE NAME, BRAND, COLOR, SIZE, STYLE CODE";

const OUTCOMES = [
  { key: "created", label: "Created", tone: "success" },
  { key: "updated", label: "Updated", tone: "info" },
  { key: "unchanged", label: "Unchanged", tone: "neutral" },
  { key: "conflict", label: "Conflicts", tone: "pending" },
  { key: "skipped", label: "Skipped", tone: "neutral" },
  { key: "failed", label: "Failed", tone: "danger" },
];
const DETAIL_TABS = ["failed", "conflict", "skipped", "updated"];
const DETAIL_HELP = {
  failed: "Rows that couldn't be imported.",
  conflict: "Item codes already in OMS under a different style — left where they are.",
  skipped: "Rows outside the divisions we import.",
  updated: "Existing items where an empty field was filled or the colour/size changed.",
};

function Progress({ done, total }) {
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {total == null ? "Reading the file…" : `${done.toLocaleString("en-IN")} of ${total.toLocaleString("en-IN")} rows · ${pct}%`}
      </p>
    </div>
  );
}

function Summary({ job }) {
  const [tab, setTab] = useState(null);
  const [getUrl, { isLoading: loadingUrl }] = useGetProductImportDetailsUrlMutation();
  const { showToast } = useToast();
  const counts = job.counts ?? {};
  const tabs = DETAIL_TABS.filter((k) => (job.preview?.[k] ?? []).length > 0);
  const current = tab && tabs.includes(tab) ? tab : tabs[0];
  const download = async () => {
    try {
      const { url } = await getUrl(job.id).unwrap();
      window.location.assign(url);
    } catch (err) {
      showToast(formatApiError(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {OUTCOMES.map(({ key, label, tone }) => (
          <div key={key} className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{(counts[key] ?? 0).toLocaleString("en-IN")}</p>
            {(counts[key] ?? 0) > 0 && key !== "unchanged" && <StatusBadge tone={tone} className="mt-1">{key}</StatusBadge>}
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {(counts.products_created ?? 0).toLocaleString("en-IN")} new products · {(counts.mappings_created ?? 0).toLocaleString("en-IN")} Shopify
        mappings created, {(counts.mappings_resolved ?? 0).toLocaleString("en-IN")} resolved
        {counts.duplicates_in_file ? ` · ${counts.duplicates_in_file} duplicate item codes in the file (one row used)` : ""}
      </p>

      {tabs.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {tabs.map((k) => (
              <Button key={k} size="sm" variant={k === current ? "default" : "outline"} onClick={() => setTab(k)}>
                {OUTCOMES.find((o) => o.key === k).label} ({(counts[k] ?? 0).toLocaleString("en-IN")})
              </Button>
            ))}
            {job.can_download_details && (
              <Button size="sm" variant="outline" className="ml-auto" onClick={download} disabled={loadingUrl}>
                <FileDown className="size-4" /> Download all rows (CSV)
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {DETAIL_HELP[current]} Showing up to {job.preview[current].length} here.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item code</TableHead>
                <TableHead>Sheet</TableHead>
                <TableHead>Row</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {job.preview[current].map((d) => (
                <TableRow key={`${d.sheet}-${d.row}`}>
                  <TableCell className="font-mono text-xs">{d.item_code || "—"}</TableCell>
                  <TableCell>{d.sheet}</TableCell>
                  <TableCell>{d.row}</TableCell>
                  <TableCell>{d.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function JobPanel({ id }) {
  const { data: job } = useGetProductImportQuery(id, {
    pollingInterval: POLL_MS,
    skipPollingIfUnfocused: true,
  });
  if (!job) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const active = ACTIVE.includes(job.status);
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <DialogTitle className="flex items-center gap-2 pr-10 text-base font-semibold">
        {job.filename}
        <StatusBadge tone={EXPORT_TONE[job.status]}>{job.status}</StatusBadge>
      </DialogTitle>
      {active && <Progress done={job.processed_rows} total={job.total_rows} />}
      {job.status === "failed" && <p className="text-sm text-destructive">{job.error || "The import failed."}</p>}
      {(job.status === "succeeded" || (active && job.counts && Object.keys(job.counts).length > 0)) && <Summary job={job} />}
      {!active && <p className="text-xs text-muted-foreground">Started {formatExportWhen(job.started_at)} · took {exportDuration(job)} · by {job.owner_name}</p>}
    </div>
  );
}

const formatSize = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const ACCEPTED = /\.(xlsx|csv)$/i;

function Dropzone({ file, onFile, disabled }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const { showToast } = useToast();
  const pick = (f) => {
    if (!f) return;
    if (!ACCEPTED.test(f.name)) return showToast("Upload an .xlsx or .csv file.");
    onFile(f);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) pick(e.dataTransfer.files?.[0]);
      }}
      className={`flex min-h-36 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
        over ? "border-primary bg-primary/5" : "border-border hover:border-primary/60 hover:bg-muted/40"
      } ${disabled ? "pointer-events-none opacity-60" : ""}`}
    >
      <input ref={inputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {file ? (
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="size-8 text-primary" />
          <div className="text-left">
            <p className="text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatSize(file.size)} · click or drop to replace</p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Remove file"
            onClick={(e) => {
              e.stopPropagation();
              onFile(null);
            }}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <>
          <Upload className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drop the product master here, or click to browse</p>
          <p className="text-xs text-muted-foreground">.xlsx or .csv · up to 25 MB</p>
        </>
      )}
    </div>
  );
}

export default function ProductImport() {
  const [file, setFile] = useState(null);
  const [selected, setSelected] = useState(null);
  const [create, { isLoading: uploading }] = useCreateProductImportMutation();
  const { data: list } = useGetProductImportsQuery({ page_size: 20 }, { pollingInterval: POLL_MS * 2, skipPollingIfUnfocused: true });
  const { showToast } = useToast();
  const rows = list?.rows ?? [];
  const running = rows.some((r) => ACTIVE.includes(r.status));

  const start = async () => {
    try {
      const job = await create(file).unwrap();
      setSelected(job.id);
      setFile(null);
    } catch (err) {
      showToast(formatApiError(err));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pb-6 [&>*]:shrink-0">
      <p className="text-sm text-muted-foreground">
        Upload the POS product master (.xlsx or .csv, any number of sheets) with the columns {COLUMNS_HELP}. New item codes are created, existing
        ones are only filled in, and an item whose style differs from OMS is reported, never moved. It runs in the background.
      </p>

      <Card>
        <CardContent className="space-y-3">
          <Dropzone file={file} onFile={setFile} disabled={uploading} />
          <div className="flex items-center justify-end gap-3">
            {running && <span className="text-xs text-muted-foreground">An import is running — wait for it to finish.</span>}
            <Button onClick={start} disabled={!file || uploading || running}>
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Import
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={selected != null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="top-0 left-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none p-6 sm:max-w-none">
          {selected != null && <JobPanel id={selected} />}
        </DialogContent>
      </Dialog>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Past imports</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No imports yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Conflicts</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r.id)}>
                  <TableCell className="max-w-64 truncate">{r.filename}</TableCell>
                  <TableCell><StatusBadge tone={EXPORT_TONE[r.status]}>{r.status}</StatusBadge></TableCell>
                  <TableCell>{r.counts?.created ?? "—"}</TableCell>
                  <TableCell>{r.counts?.updated ?? "—"}</TableCell>
                  <TableCell>{r.counts?.conflict ?? "—"}</TableCell>
                  <TableCell>{r.counts?.failed ?? "—"}</TableCell>
                  <TableCell>{formatExportWhen(r.started_at ?? r.created_at)}</TableCell>
                  <TableCell>{r.owner_name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
