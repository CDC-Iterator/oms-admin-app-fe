import { useState } from "react";
import { MoreHorizontal, Plus, Warehouse } from "lucide-react";

import DataTable from "../components/DataTable.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import { ListEyebrow } from "../components/list-eyebrow.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert.jsx";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { Select } from "@/components/ui/select.jsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.jsx";
import {
  useCreateLocationMutation,
  useDeleteLocationMutation,
  useGetLocationsQuery,
  useUpdateLocationMutation,
} from "../api/services/locations.js";
import { useToast } from "../hooks/useToast.js";
import { formatApiError } from "../lib/errors.js";

const ZONES = ["Delhi North", "Mumbai West", "Hyderabad South"];
const EMPTY_FORM = { id: null, code: "", name: "", type: "store", zone: ZONES[0] };

function LocationForm({ open, onOpenChange, mode, form, setForm, onSubmit, error, isSaving }) {
  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{mode === "edit" ? `Edit ${form.name}` : "New location"}</SheetTitle>
          <SheetDescription>
            As POS 2.0 names it, with the code and zone the OMS should mirror.
          </SheetDescription>
        </SheetHeader>
        <form id="location-form" className="flex flex-1 flex-col gap-4 px-4" onSubmit={onSubmit}>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="code">Code</Label>
            <Input id="code" value={form.code} onChange={set("code")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={form.name} onChange={set("name")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type">Type</Label>
            <Select id="type" className="w-full" value={form.type} onChange={set("type")}>
              <option value="store">Store</option>
              <option value="warehouse">Warehouse</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zone">Zone</Label>
            <Select id="zone" className="w-full" value={form.zone} onChange={set("zone")}>
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </div>
        </form>
        <SheetFooter>
          <Button type="submit" form="location-form" disabled={isSaving}>
            {isSaving ? "Saving…" : mode === "edit" ? "Save changes" : "Create location"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default function LocationsList() {
  const { showToast } = useToast();
  const { data, isFetching, error, refetch } = useGetLocationsQuery();
  const [createLocation, { isLoading: isCreating }] = useCreateLocationMutation();
  const [updateLocation, { isLoading: isUpdating }] = useUpdateLocationMutation();
  const [deleteLocation, { isLoading: isDeleting }] = useDeleteLocationMutation();

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const openCreate = () => {
    setFormMode("create");
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };
  const openEdit = (row) => {
    setFormMode("edit");
    setForm({ id: row.id, code: row.code, name: row.name, type: row.type, zone: row.zone });
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);
    const payload = { code: form.code, name: form.name, type: form.type, zone: form.zone };
    try {
      if (formMode === "edit") {
        await updateLocation({ id: form.id, ...payload }).unwrap();
        showToast(`${form.name} updated.`);
      } else {
        await createLocation(payload).unwrap();
        showToast(`${form.name} created.`);
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(formatApiError(err));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteLocation(deleteTarget.id).unwrap();
      showToast(`${deleteTarget.name} removed.`);
      setDeleteTarget(null);
    } catch {
      // Dialog stays open; the mutation's error state is visible via toast elsewhere in the app.
    }
  };

  const COLUMNS = [
    { key: "code", label: "Code", mono: true },
    { key: "name", label: "Name" },
    {
      key: "type",
      label: "Type",
      render: (row) => <StatusBadge tone={row.type === "warehouse" ? "info" : "neutral"}>{row.type}</StatusBadge>,
    },
    { key: "zone", label: "Zone" },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Actions</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(row)}>Edit</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(row)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          The stores and warehouses as POS 2.0 names them — feeds inventory breakdown and allocation.
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-3.5" />
          New location
        </Button>
      </div>
      <ListEyebrow count={data?.count ?? 0} noun="locations" label="Managed in this admin" live={false} />
      <DataTable
        columns={COLUMNS}
        rows={data?.rows ?? []}
        loading={isFetching}
        error={formatApiError(error)}
        onRetry={refetch}
        empty={
          <EmptyState
            icon={Warehouse}
            title="No locations yet"
            description="Add the stores and warehouses that carry stock."
            action={
              <Button size="sm" variant="outline" onClick={openCreate}>
                New location
              </Button>
            }
          />
        }
      />

      <LocationForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        error={formError}
        isSaving={formMode === "edit" ? isUpdating : isCreating}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
