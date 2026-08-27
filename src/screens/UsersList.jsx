import { useState } from "react";
import { MoreHorizontal, Plus, Users } from "lucide-react";

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
import { Checkbox } from "@/components/ui/checkbox.jsx";
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
import { useGetLocationsQuery } from "../api/services/locations.js";
import {
  useCreateUserMutation,
  useDeleteUserMutation,
  useGetUsersQuery,
  useUpdateUserMutation,
} from "../api/services/users.js";
import { useAuth } from "../hooks/useAuth.js";
import { useToast } from "../hooks/useToast.js";
import { formatApiError } from "../lib/errors.js";

const ROLES = [
  { value: "admin", label: "Admin", description: "Full access to every screen and module." },
  { value: "fulfilment", label: "Fulfilment", description: "Scoped to specific locations and modules." },
  { value: "reporting", label: "Reporting", description: "Read-only access, no write actions." },
];

const ROLE_TONE = { admin: "success", fulfilment: "info", reporting: "neutral" };

const EMPTY_FORM = {
  id: null,
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  password: "",
  role: "reporting",
  locations: [],
  is_active: true,
};

function UserForm({ open, onOpenChange, mode, form, setForm, onSubmit, error, isSaving, locationOptions }) {
  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));
  const setChecked = (key) => (checked) => setForm((f) => ({ ...f, [key]: checked }));
  const toggleLocation = (code) =>
    setForm((f) => ({
      ...f,
      locations: f.locations.includes(code)
        ? f.locations.filter((c) => c !== code)
        : [...f.locations, code],
    }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{mode === "edit" ? `Edit ${form.username}` : "New user"}</SheetTitle>
          <SheetDescription>
            {mode === "edit"
              ? "Leave the password blank to keep it unchanged."
              : "A staff sign-in for CDC OMS — not a Shopify customer account."}
          </SheetDescription>
        </SheetHeader>
        <form
          id="user-form"
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
          onSubmit={onSubmit}
        >
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={form.username} onChange={set("username")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={set("email")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="first_name">First name</Label>
              <Input id="first_name" value={form.first_name} onChange={set("first_name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name">Last name</Label>
              <Input id="last_name" value={form.last_name} onChange={set("last_name")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{mode === "edit" ? "New password" : "Password"}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={set("password")}
              required={mode === "create"}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <Select id="role" className="w-full" value={form.role} onChange={set("role")}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">
              {ROLES.find((r) => r.value === form.role)?.description}
            </p>
          </div>
          {form.role === "fulfilment" && (
            <div className="space-y-1.5">
              <Label>Locations</Label>
              <div className="space-y-1.5 rounded-lg border border-input p-2.5">
                {locationOptions.map((loc) => (
                  <label key={loc.code} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.locations.includes(loc.code)}
                      onCheckedChange={() => toggleLocation(loc.code)}
                    />
                    {loc.name} <span className="font-mono text-xs text-muted-foreground">{loc.code}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 pt-1 text-sm">
            <Checkbox checked={form.is_active} onCheckedChange={setChecked("is_active")} />
            Active
          </label>
        </form>
        <SheetFooter>
          <Button type="submit" form="user-form" disabled={isSaving}>
            {isSaving ? "Saving…" : mode === "edit" ? "Save changes" : "Create user"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default function UsersList() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const { data, isFetching, error, refetch } = useGetUsersQuery();
  const { data: locations } = useGetLocationsQuery();
  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const openCreate = () => {
    setFormMode("create");
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setFormMode("edit");
    setForm({
      id: row.id,
      username: row.username,
      email: row.email || "",
      first_name: row.first_name || "",
      last_name: row.last_name || "",
      password: "",
      role: row.role || "reporting",
      locations: row.locations || [],
      is_active: row.is_active,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const openDelete = (row) => {
    setDeleteError(null);
    setDeleteTarget(row);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);
    const payload = {
      username: form.username,
      email: form.email,
      first_name: form.first_name,
      last_name: form.last_name,
      role: form.role,
      locations: form.role === "fulfilment" ? form.locations : [],
      is_active: form.is_active,
    };
    if (form.password) payload.password = form.password;

    try {
      if (formMode === "edit") {
        await updateUser({ id: form.id, ...payload }).unwrap();
        showToast(`${form.username} updated.`);
      } else {
        await createUser(payload).unwrap();
        showToast(`${form.username} created.`);
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(formatApiError(err));
    }
  };

  const handleDelete = async () => {
    setDeleteError(null);
    try {
      await deleteUser(deleteTarget.id).unwrap();
      showToast(`${deleteTarget.username} deleted.`);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(formatApiError(err));
    }
  };

  const COLUMNS = [
    { key: "username", label: "Username", mono: true },
    { key: "email", label: "Email", render: (row) => row.email || "—" },
    {
      key: "name",
      label: "Name",
      render: (row) => [row.first_name, row.last_name].filter(Boolean).join(" ") || "—",
    },
    {
      key: "role",
      label: "Role",
      render: (row) => (
        <StatusBadge tone={ROLE_TONE[row.role] ?? "neutral"}>
          {ROLES.find((r) => r.value === row.role)?.label ?? row.role}
        </StatusBadge>
      ),
    },
    {
      key: "locations",
      label: "Locations",
      render: (row) =>
        row.role === "fulfilment"
          ? (row.locations?.length ? row.locations.join(", ") : "None assigned")
          : "All",
    },
    {
      key: "is_active",
      label: "Status",
      render: (row) => (
        <StatusBadge tone={row.is_active ? "success" : "danger"}>
          {row.is_active ? "Active" : "Disabled"}
        </StatusBadge>
      ),
    },
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
            <DropdownMenuItem
              variant="destructive"
              disabled={row.id === currentUser?.id}
              onClick={() => openDelete(row)}
            >
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
          Staff accounts with sign-in access to CDC OMS — Admin, Fulfilment (location-scoped), or
          Reporting (read-only).
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-3.5" />
          New user
        </Button>
      </div>
      <ListEyebrow
        count={data?.count ?? 0}
        noun="users"
        label="Managed in this admin"
        live={false}
      />
      <DataTable
        columns={COLUMNS}
        rows={data?.rows ?? []}
        loading={isFetching}
        error={formatApiError(error)}
        onRetry={refetch}
        empty={
          <EmptyState
            icon={Users}
            title="No users yet"
            description="Create the first staff account to get started."
            action={
              <Button size="sm" variant="outline" onClick={openCreate}>
                New user
              </Button>
            }
          />
        }
      />

      <UserForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        error={formError}
        isSaving={formMode === "edit" ? isUpdating : isCreating}
        locationOptions={locations?.rows ?? []}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes their access. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}
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
