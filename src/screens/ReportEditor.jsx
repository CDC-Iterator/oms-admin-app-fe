import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Trash2, X } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import DateRangeSelect from "../components/report-builder/DateRangeSelect.jsx";
import FilterRows from "../components/report-builder/FilterRows.jsx";
import PickerPopover from "../components/report-builder/PickerPopover.jsx";
import ResultTable from "../components/report-builder/ResultTable.jsx";
import ExportMenu from "../components/ExportMenu.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert.jsx";
import { Button, buttonVariants } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Select } from "@/components/ui/select.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import {
  useCreateReportDefMutation,
  useDeleteReportDefMutation,
  useGetReportCatalogQuery,
  useGetReportDefQuery,
  useRunReportMutation,
  useUpdateReportDefMutation,
} from "../api/services/reportBuilder.js";
import { useAuth } from "../hooks/useAuth.js";
import { useToast } from "../hooks/useToast.js";
import { formatApiError } from "../lib/errors.js";
import { isAdminUser } from "../lib/permissions.js";
import { BUCKET_LABELS, cleanConfig, emptyConfig, isRunnable } from "../lib/reportBuilder.js";

const RUN_DELAY_MS = 450;

function Section({ title, action, children }) {
  return (
    <section className="rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <h3 className="text-sm font-medium">{title}</h3>
        {action}
      </div>
      <div className="p-2">{children}</div>
    </section>
  );
}

// A chosen column/metric/dimension, with reorder and remove.
function ChosenRow({ label, onUp, onDown, onRemove, children }) {
  return (
    <li className="flex items-center gap-1 rounded-md px-1.5 py-1 text-sm hover:bg-muted/60">
      <span className="min-w-0 flex-1 truncate" title={label}>
        {label}
      </span>
      {children}
      {onUp && (
        <button type="button" aria-label="Move up" onClick={onUp} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
          <ArrowUp className="size-3.5" />
        </button>
      )}
      {onDown && (
        <button type="button" aria-label="Move down" onClick={onDown} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
          <ArrowDown className="size-3.5" />
        </button>
      )}
      <button type="button" aria-label="Remove" onClick={onRemove} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
        <X className="size-3.5" />
      </button>
    </li>
  );
}

const move = (list, i, delta) => {
  const next = [...list];
  const j = i + delta;
  if (j < 0 || j >= next.length) return list;
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

// Keep the order already chosen; new picks go to the end.
const applyPicks = (current, picked) => [...current.filter((k) => picked.includes(k)), ...picked.filter((k) => !current.includes(k))];

export default function ReportEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const admin = isAdminUser(user);

  const { data: catalog, isLoading: catalogLoading, error: catalogError } = useGetReportCatalogQuery();
  const { data: saved, error: loadError } = useGetReportDefQuery(id, { skip: isNew });
  const [runReport] = useRunReportMutation();
  const [createDef, { isLoading: creating }] = useCreateReportDefMutation();
  const [updateDef, { isLoading: updating }] = useUpdateReportDefMutation();
  const [deleteDef] = useDeleteReportDefMutation();

  const [name, setName] = useState("");
  const [resourceKey, setResourceKey] = useState("orders");
  const [config, setConfig] = useState(null);
  const [shared, setShared] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const runCount = useRef(0);
  const loadedFor = useRef(null);

  const resources = catalog?.resources ?? [];
  const resource = resources.find((r) => r.key === resourceKey);

  // New report: start from the first resource's default columns. Saved: load once per id.
  useEffect(() => {
    if (!resources.length) return;
    if (isNew && loadedFor.current !== "new") {
      loadedFor.current = "new";
      setName("");
      setResourceKey(resources[0].key);
      setConfig(emptyConfig(resources[0]));
      setShared(false);
      setDirty(false);
      setResult(null);
    } else if (!isNew && saved && loadedFor.current !== id) {
      loadedFor.current = id;
      setName(saved.name);
      setResourceKey(saved.resource);
      setConfig({ ...emptyConfig(resources.find((r) => r.key === saved.resource)), ...saved.config });
      setShared(saved.is_shared);
      setDirty(false);
    }
  }, [resources, isNew, saved, id]);

  const fields = resource?.fields ?? [];
  const byField = useMemo(() => Object.fromEntries(fields.map((f) => [f.key, f])), [fields]);
  const metricByKey = useMemo(() => Object.fromEntries((resource?.metrics ?? []).map((m) => [m.key, m])), [resource]);

  const edit = (patch) => {
    setConfig((c) => ({ ...c, ...patch }));
    setDirty(true);
  };

  // Re-run the preview shortly after the config settles.
  const cleaned = useMemo(() => (config ? cleanConfig(config) : null), [config]);
  const configKey = JSON.stringify(cleaned);
  useEffect(() => {
    if (!cleaned || !resource || !isRunnable(config)) {
      setResult(null);
      return undefined;
    }
    const mine = ++runCount.current;
    setRunning(true);
    const timer = setTimeout(async () => {
      try {
        const data = await runReport({ resource: resourceKey, config: cleaned, limit: 100 }).unwrap();
        if (mine === runCount.current) {
          setResult(data);
          setRunError(null);
        }
      } catch (err) {
        if (mine === runCount.current) {
          setRunError(formatApiError(err));
          setResult(null);
        }
      } finally {
        if (mine === runCount.current) setRunning(false);
      }
    }, RUN_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey, resourceKey, resource]);

  const changeResource = (key) => {
    const next = resources.find((r) => r.key === key);
    setResourceKey(key);
    setConfig(emptyConfig(next));
    setResult(null);
    setDirty(true);
  };

  const setMode = (mode) => {
    if (mode === config.mode) return;
    edit({ mode, ordering: [] });
  };

  const sortOptions =
    config?.mode === "summary"
      ? [
          ...config.dimensions.map((d) => ({ key: d.field, label: byField[d.field]?.label ?? d.field })),
          ...config.metrics.map((m) => ({ key: m, label: metricByKey[m]?.label ?? m })),
        ]
      : fields.map((f) => ({ key: f.key, label: f.label }));
  const sort = config?.ordering?.[0];

  const save = async () => {
    setSaveError(null);
    try {
      const body = { name: name.trim(), resource: resourceKey, config: cleaned, is_shared: shared };
      if (isNew) {
        const created = await createDef(body).unwrap();
        loadedFor.current = String(created.id);
        showToast("Report saved.");
        navigate(`/reports/${created.id}`, { replace: true });
      } else {
        await updateDef({ id, ...body }).unwrap();
        showToast("Report saved.");
      }
      setDirty(false);
    } catch (err) {
      setSaveError(formatApiError(err));
    }
  };

  const remove = async () => {
    try {
      await deleteDef(id).unwrap();
      showToast("Report deleted.");
      navigate("/reports", { replace: true });
    } catch (err) {
      showToast(formatApiError(err));
    }
  };

  if (catalogError || loadError) {
    return <EmptyState tone="danger" title="Couldn't open this report" description={formatApiError(catalogError ?? loadError)} />;
  }
  if (catalogLoading || !config || !resource) return <Skeleton className="h-96 w-full" />;

  const canSave = name.trim() && isRunnable(config) && (isNew || dirty) && !creating && !updating;
  const isOwner = isNew || saved?.is_owner;
  const exportBody =
    !isNew && !dirty ? { resource: "reports", object_id: Number(id) } : { resource: "reports", params: { resource: resourceKey, config: cleaned, name: name.trim() } };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <Link to="/reports" aria-label="Back to reports" className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeft className="size-4" />
        </Link>
        <Input
          value={name}
          placeholder="Untitled report"
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
          }}
          disabled={!isOwner}
          className="max-w-xs font-medium"
          aria-label="Report name"
        />
        {isNew ? (
          <Select value={resourceKey} onChange={(e) => changeResource(e.target.value)} aria-label="Resource">
            {resources.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </Select>
        ) : (
          <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">{resource.label}</span>
        )}
        {resource.date_field && (
          <DateRangeSelect value={config.date_range} onChange={(v) => edit({ date_range: v })} fieldLabel={byField[resource.date_field]?.label} />
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {dirty && !isNew && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
          {admin && isOwner && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="oms-checkbox"
                checked={shared}
                onChange={(e) => {
                  setShared(e.target.checked);
                  setDirty(true);
                }}
              />
              Share with team
            </label>
          )}
          <ExportMenu resource="reports" body={exportBody} disabled={!isRunnable(config)} />
          {isOwner && (
            <Button onClick={save} disabled={!canSave}>
              {creating || updating ? "Saving…" : "Save"}
            </Button>
          )}
          {!isNew && isOwner && (
            <Button variant="outline" size="icon" aria-label="Delete report" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {saveError && (
        <Alert variant="destructive" className="mb-3 shrink-0">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-h-0 flex-col gap-2">
          {runError && (
            <Alert variant="destructive" className="shrink-0">
              <AlertDescription>{runError}</AlertDescription>
            </Alert>
          )}
          {!isRunnable(config) ? (
            <EmptyState
              title={config.mode === "summary" ? "Add a metric to see results" : "Add a column to see results"}
              description={config.mode === "summary" ? "Pick metrics, then group them by dimensions." : "Pick the columns you want in the report."}
            />
          ) : result ? (
            <>
              <ResultTable result={result} loading={running} />
              <p className="shrink-0 text-xs text-muted-foreground">
                {result.truncated ? `Showing the first ${result.rows.length} rows — Export CSV has them all.` : `${result.rows.length} row${result.rows.length === 1 ? "" : "s"}.`}
                {result.total != null && result.truncated && ` ${result.total.toLocaleString("en-IN")} in total.`}
              </p>
            </>
          ) : (
            !runError && <Skeleton className="h-64 w-full" />
          )}
        </div>

        <aside className="min-h-0 space-y-3 overflow-auto pb-4">
          {resource.summary && (
            <div className="grid grid-cols-2 rounded-lg bg-muted p-0.5 text-sm">
              {[
                ["records", "Records"],
                ["summary", "Summary"],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setMode(mode)}
                  className={`rounded-md px-3 py-1.5 font-medium transition-colors ${config.mode === mode ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {config.mode === "records" ? (
            <Section
              title="Columns"
              action={<PickerPopover title="Columns" items={fields} selected={config.columns} onApply={(picked) => edit({ columns: applyPicks(config.columns, picked) })} />}
            >
              <ul>
                {config.columns.map((key, i) => (
                  <ChosenRow
                    key={key}
                    label={byField[key]?.label ?? key}
                    onUp={i > 0 ? () => edit({ columns: move(config.columns, i, -1) }) : null}
                    onDown={i < config.columns.length - 1 ? () => edit({ columns: move(config.columns, i, 1) }) : null}
                    onRemove={() => edit({ columns: config.columns.filter((k) => k !== key) })}
                  />
                ))}
                {config.columns.length === 0 && <li className="px-1.5 py-1 text-sm text-muted-foreground">No columns yet.</li>}
              </ul>
            </Section>
          ) : (
            <>
              <Section
                title="Metrics"
                action={
                  <PickerPopover
                    title="Metrics"
                    items={resource.metrics}
                    selected={config.metrics}
                    onApply={(picked) => edit({ metrics: applyPicks(config.metrics, picked), ordering: [] })}
                  />
                }
              >
                <ul>
                  {config.metrics.map((key) => (
                    <ChosenRow key={key} label={metricByKey[key]?.label ?? key} onRemove={() => edit({ metrics: config.metrics.filter((k) => k !== key), ordering: [] })} />
                  ))}
                  {config.metrics.length === 0 && <li className="px-1.5 py-1 text-sm text-muted-foreground">No metrics yet.</li>}
                </ul>
              </Section>
              <Section
                title="Dimensions"
                action={
                  <PickerPopover
                    title="Dimensions"
                    items={fields.filter((f) => f.dimension)}
                    selected={config.dimensions.map((d) => d.field)}
                    onApply={(picked) =>
                      edit({
                        dimensions: applyPicks(config.dimensions.map((d) => d.field), picked.slice(0, 3)).map(
                          (key) => config.dimensions.find((d) => d.field === key) ?? { field: key, bucket: byField[key]?.type === "datetime" ? "day" : null }
                        ),
                        ordering: [],
                      })
                    }
                  />
                }
              >
                <ul>
                  {config.dimensions.map((dim, i) => (
                    <ChosenRow
                      key={dim.field}
                      label={byField[dim.field]?.label ?? dim.field}
                      onUp={i > 0 ? () => edit({ dimensions: move(config.dimensions, i, -1) }) : null}
                      onDown={i < config.dimensions.length - 1 ? () => edit({ dimensions: move(config.dimensions, i, 1) }) : null}
                      onRemove={() => edit({ dimensions: config.dimensions.filter((d) => d.field !== dim.field), ordering: [] })}
                    >
                      {byField[dim.field]?.type === "datetime" && (
                        <Select
                          className="w-24"
                          value={dim.bucket ?? "day"}
                          aria-label="Group dates by"
                          onChange={(e) => edit({ dimensions: config.dimensions.map((d) => (d.field === dim.field ? { ...d, bucket: e.target.value } : d)) })}
                        >
                          {(catalog.buckets ?? []).map((b) => (
                            <option key={b} value={b}>
                              {BUCKET_LABELS[b] ?? b}
                            </option>
                          ))}
                        </Select>
                      )}
                    </ChosenRow>
                  ))}
                  {config.dimensions.length === 0 && <li className="px-1.5 py-1 text-sm text-muted-foreground">No grouping — one row of totals.</li>}
                </ul>
              </Section>
            </>
          )}

          <Section title="Filters">
            <FilterRows fields={fields} filters={config.filters} onChange={(filters) => edit({ filters })} />
          </Section>

          <Section title="Sort">
            <div className="flex items-center gap-1">
              <Select
                className="min-w-0 flex-1"
                value={sort?.key ?? ""}
                aria-label="Sort by"
                onChange={(e) => edit({ ordering: e.target.value ? [{ key: e.target.value, desc: sort?.desc ?? false }] : [] })}
              >
                <option value="">Default</option>
                {sortOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <Select
                value={sort?.desc ? "desc" : "asc"}
                aria-label="Sort direction"
                disabled={!sort}
                onChange={(e) => edit({ ordering: [{ key: sort.key, desc: e.target.value === "desc" }] })}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </Select>
            </div>
          </Section>
        </aside>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this report?</AlertDialogTitle>
            <AlertDialogDescription>"{name}" will be removed for everyone it's shared with. Past exports of it stay downloadable.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
            <Button variant="destructive" onClick={remove}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
