import { useState } from "react";
import { Bookmark, Check, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button.jsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.jsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.jsx";
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
 * "Views" menu for a list screen: pick a saved filter set, or save the current one.
 * `resource` is the saved-view resource key (orders | fulfillments | inventory | activity);
 * `params` the screen's current filters and `onApply(params)` restores a saved set.
 */
export default function SavedViews({ resource, params, onApply }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const admin = isAdminUser(user);
  const { data: views = [] } = useGetSavedViewsQuery(resource);
  const [createView, { isLoading: saving }] = useCreateSavedViewMutation();
  const [deleteView] = useDeleteSavedViewMutation();
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

  const remove = async (view) => {
    try {
      await deleteView(view.id).unwrap();
      showToast(`View “${view.name}” deleted.`);
    } catch (err) {
      showToast(formatApiError(err));
    }
  };

  const renderView = (view) => (
    <DropdownMenuItem key={view.id} onClick={() => onApply(view.params)} className="justify-between gap-3">
      <span className="flex min-w-0 items-center gap-1.5">
        {active?.id === view.id ? <Check className="size-3.5 shrink-0" /> : <span className="size-3.5 shrink-0" />}
        <span className="truncate">{view.name}</span>
      </span>
      {(view.is_owner || admin) && (
        <button
          type="button"
          aria-label={`Delete ${view.name}`}
          className="rounded p-0.5 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            remove(view);
          }}
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </DropdownMenuItem>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
          <Bookmark className="size-3.5" />
          {active ? active.name : "Views"}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          {mine.length > 0 && (
            <DropdownMenuGroup>
              <DropdownMenuLabel>My views</DropdownMenuLabel>
              {mine.map(renderView)}
            </DropdownMenuGroup>
          )}
          {teamViews.length > 0 && (
            <DropdownMenuGroup>
              <DropdownMenuLabel>Shared</DropdownMenuLabel>
              {teamViews.map(renderView)}
            </DropdownMenuGroup>
          )}
          {views.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">No saved views yet.</p>}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!hasFilters} onClick={openSave}>
            Save current view…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
    </>
  );
}
