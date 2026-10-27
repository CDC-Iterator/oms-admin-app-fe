import { useState } from "react";
import { Plus, X } from "lucide-react";

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert.jsx";
import {
  useCreateSavedViewMutation,
  useDeleteSavedViewMutation,
  useGetSavedViewsQuery,
} from "../api/services/savedViews.js";
import { useAuth } from "../hooks/useAuth.js";
import { useToast } from "../hooks/useToast.js";
import { formatApiError } from "../lib/errors.js";
import { isAdminUser } from "../lib/permissions.js";

const sameParams = (a, b) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((k) => String(a[k] ?? "") === String(b[k] ?? ""));
};

/**
 * Scrollable saved-view tabs for a list screen: pick a saved filter set, or save the current one.
 * `resource` is the saved-view resource key (orders | fulfillments | inventory | activity);
 * `params` the screen's current filters and `onApply(params)` restores a saved set.
 * `useCount(params)` is a hook returning how many rows a view's filters match, shown on its tab.
 */
function TabCount({ useCount, params }) {
  const count = useCount(params);
  return count === undefined ? null : <span className="ml-1 tabular-nums opacity-70">({count.toLocaleString("en-IN")})</span>;
}

export default function SavedViews({ resource, params, onApply, useCount }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const admin = isAdminUser(user);
  const { data: views = [] } = useGetSavedViewsQuery(resource);
  const [createView, { isLoading: saving }] = useCreateSavedViewMutation();
  const [deleteView, { isLoading: deleting }] = useDeleteSavedViewMutation();
  const [toDelete, setToDelete] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [error, setError] = useState(null);

  const mine = views.filter((v) => v.is_owner);
  const teamViews = views.filter((v) => !v.is_owner);
  const active = views.find((v) => sameParams(v.params, params));
  const hasFilters = Object.keys(params).length > 0;

  const openSave = () => {
    setName("");
    setShared(false);
    setError(null);
    setDialogOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setError(null);
    try {
      await createView({ name, resource, params, is_shared: admin && shared }).unwrap();
      showToast(`View “${name.trim()}” saved.`);
      setDialogOpen(false);
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const confirmDelete = async () => {
    const view = toDelete;
    try {
      await deleteView(view.id).unwrap();
      showToast(`View “${view.name}” deleted.`);
    } catch (err) {
      showToast(formatApiError(err));
    }
    setToDelete(null);
  };

  // Same underlined tabs as the Reports and status tabs.
  const tab = (selected) =>
    "rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors " +
    (selected ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground");

  const renderView = (view) => {
    const selected = active?.id === view.id;
    return (
      <div key={view.id} role="presentation" className={"group flex items-center " + tab(selected)}>
        <button
          type="button"
          role="tab"
          aria-selected={selected}
          onClick={() => onApply(view.params)}
          title={view.is_owner ? undefined : `Shared by ${view.owner}`}
        >
          {view.name}
          {useCount && <TabCount useCount={useCount} params={view.params} />}
        </button>
        {(view.is_owner || admin) && (
          <button
            type="button"
            aria-label={`Delete ${view.name}`}
            className={
              "ml-1.5 rounded p-0.5 text-muted-foreground hover:text-destructive focus:opacity-100 " +
              (selected ? "" : "opacity-0 group-hover:opacity-100")
            }
            onClick={() => setToDelete(view)}
          >
            <X className="size-3" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="order-last w-full min-w-0">
      <div
        role="tablist"
        aria-label="Saved views"
        className="flex items-center gap-1 overflow-x-auto border-b border-border pb-px [scrollbar-width:thin]"
      >
        <button type="button" role="tab" aria-selected={!active && !hasFilters} onClick={() => onApply({})} className={tab(!active && !hasFilters)}>
          All
          {useCount && <TabCount useCount={useCount} params={{}} />}
        </button>
        {mine.map(renderView)}
        {teamViews.map(renderView)}
        {hasFilters && !active && (
          <button type="button" onClick={openSave} className={tab(false) + " flex items-center gap-1"}>
            <Plus className="size-3.5" />
            Save view
          </button>
        )}
      </div>

      <AlertDialog open={Boolean(toDelete)} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{toDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.is_shared
                ? "This view is shared, so it disappears for everyone who uses it. This can't be undone."
                : "This saved view will be removed. This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete view"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={save} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Save view</DialogTitle>
              <DialogDescription>Saves the current filters, sort order and search.</DialogDescription>
            </DialogHeader>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Input autoFocus placeholder="View name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
            {admin && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="oms-checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
                Share with everyone who can see this screen
              </label>
            )}
            <DialogFooter>
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? "Saving…" : "Save view"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
