import { useEffect, useState } from "react";
import { Pencil, Plus, Power, UserCog } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { EmptyState } from "../components/empty-state.jsx";
import Pagination from "../components/Pagination.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert.jsx";
import { Button } from "@/components/ui/button.jsx";
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
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.jsx";
import { useCreateUserMutation, useGetUsersQuery, useUpdateUserMutation } from "../api/services/users.js";
import { useAuth } from "../hooks/useAuth.js";
import { useToast } from "../hooks/useToast.js";
import { formatApiError } from "../lib/errors.js";

const PAGE_SIZE = 50;

// User.Role choices — apps.accounts.models.
const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "fulfilment", label: "Fulfilment" },
  { value: "reporting", label: "Reporting" },
];

const EMPTY_FORM = {
  id: null,
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  role: "reporting",
  is_active: true,
  is_superuser: false,
};

function useDebounced(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function UserForm({ open, onOpenChange, mode, form, setForm, onSubmit, error, isSaving }) {
  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));
  const setChecked = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.checked }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{mode === "edit" ? `Edit ${form.email}` : "New user"}</SheetTitle>
          <SheetDescription>
            {mode === "edit" ? "Leave password blank to keep it unchanged." : "Super admins only."}
          </SheetDescription>
        </SheetHeader>
        <form id="user-form" className="flex flex-1 flex-col gap-4 px-4" onSubmit={onSubmit}>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={set("email")} disabled={mode === "edit"} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{mode === "edit" ? "New password (optional)" : "Password"}</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={set("password")}
              required={mode !== "edit"}
            />
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
            <Label htmlFor="role">Role</Label>
            <Select id="role" className="w-full" value={form.role} onChange={set("role")}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={setChecked("is_active")} />
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

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);

  // Page lives in the URL (?page=), not component state — a refresh (or a
  // shared/bookmarked link) lands back on the same page instead of
  // silently resetting to 1.
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page")) || 1;
  const setPage = (nextPage) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (nextPage <= 1) {
          next.delete("page");
        } else {
          next.set("page", String(nextPage));
        }
        return next;
      },
      { replace: true }
    );
  };

  // Page resets to 1 from the search handler directly, not a useEffect
  // keyed on [debouncedSearch] — that also fires on mount (and
  // StrictMode's dev-only double-invoke defeats any ref-based "skip the
  // first run" guard), clobbering ?page= from a refreshed/shared URL.
  const handleSearchChange = (value) => {
    setSearch(value);
    setPage(1);
  };

  const searchParam = debouncedSearch || undefined;
  const { data, isFetching, error, refetch } = useGetUsersQuery({ page, search: searchParam });
  const rows = data?.rows ?? [];

  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);

  const openCreate = () => {
    setFormMode("create");
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };
  const openEdit = (row) => {
    setFormMode("edit");
    setForm({ ...row, password: "" });
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);
    const { id, password, ...rest } = form;
    const payload = password ? { ...rest, password } : rest;
    try {
      if (formMode === "edit") {
        await updateUser({ id, ...payload }).unwrap();
        showToast(`${form.email} updated.`);
      } else {
        await createUser(payload).unwrap();
        showToast(`${form.email} created.`);
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(formatApiError(err));
    }
  };

  const toggleActive = async (row) => {
    try {
      await updateUser({ id: row.id, is_active: !row.is_active }).unwrap();
      showToast(`${row.email} ${row.is_active ? "deactivated" : "reactivated"}.`);
    } catch (err) {
      showToast(formatApiError(err));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">Staff accounts — only super admins can add or edit users.</p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-3.5" />
          New user
        </Button>
      </div>

      <Input
        placeholder="Search email, name…"
        value={search}
        onChange={(e) => handleSearchChange(e.target.value)}
        className="mb-3 w-full shrink-0"
      />

      {error ? (
        <EmptyState
          tone="danger"
          title="Couldn't load users"
          description={`${formatApiError(error)} — try again.`}
          action={
            <Button size="sm" variant="outline" onClick={refetch}>
              Try again
            </Button>
          }
        />
      ) : isFetching && !data ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No users found"
          description="Try a different search."
          action={
            <Button size="sm" variant="outline" onClick={openCreate}>
              New user
            </Button>
          }
        />
      ) : (
        // See InventoryList.jsx's own comment for why overflow-hidden lands
        // here and min-h-0/flex-1 on the nested [data-slot=table-container].
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl ring-1 ring-border [&>[data-slot=table-container]]:min-h-0 [&>[data-slot=table-container]]:flex-1">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="border-b-2 border-border">Email</TableHead>
                <TableHead className="border-b-2 border-border">Name</TableHead>
                <TableHead className="border-b-2 border-border text-center">Role</TableHead>
                <TableHead className="border-b-2 border-border text-center">Super admin</TableHead>
                <TableHead className="border-b-2 border-border text-center">Status</TableHead>
                <TableHead className="border-b-2 border-border text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const isSelf = row.id === currentUser?.id;
                // Only a superuser can write a superuser's own row — see
                // common.permissions.IsSuperAdmin.has_object_permission.
                const lockedSuperuser = row.is_superuser && !currentUser?.is_superuser;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.email}</TableCell>
                    <TableCell className="text-sm">{`${row.first_name} ${row.last_name}`.trim() || "—"}</TableCell>
                    <TableCell className="text-center">
                      <StatusBadge tone="neutral">{row.role}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-center">
                      {row.is_superuser ? <StatusBadge tone="info">Super admin</StatusBadge> : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge tone={row.is_active ? "success" : "danger"}>
                        {row.is_active ? "Active" : "Inactive"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="outline"
                                size="icon-sm"
                                disabled={lockedSuperuser}
                                onClick={() => openEdit(row)}
                              />
                            }
                          >
                            <Pencil className="size-3.5" />
                            <span className="sr-only">Edit</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {lockedSuperuser ? "Only a super admin can edit a super admin" : "Edit"}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="outline"
                                size="icon-sm"
                                disabled={isSelf || lockedSuperuser}
                                onClick={() => toggleActive(row)}
                              />
                            }
                          >
                            <Power className="size-3.5" />
                            <span className="sr-only">{row.is_active ? "Deactivate" : "Reactivate"}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isSelf
                              ? "Can't deactivate your own account"
                              : lockedSuperuser
                                ? "Only a super admin can deactivate a super admin"
                                : row.is_active
                                  ? "Deactivate"
                                  : "Reactivate"}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="shrink-0">
        <Pagination page={page} pageSize={PAGE_SIZE} count={data?.count ?? 0} onPageChange={setPage} />
      </div>

      <UserForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        error={formError}
        isSaving={formMode === "edit" ? isUpdating : isCreating}
      />
    </div>
  );
}
