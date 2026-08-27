import { useState } from "react";
import { Link2, MoreHorizontal, Plus } from "lucide-react";

import DataTable from "../components/DataTable.jsx";
import { ChannelBadge } from "../components/ChannelBadge.jsx";
import { EmptyState } from "../components/empty-state.jsx";
import { ListEyebrow } from "../components/list-eyebrow.jsx";
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
import { useGetInventoryPoolQuery } from "../api/services/inventory.js";
import {
  useCreateMappingMutation,
  useDeleteMappingMutation,
  useGetMappingsQuery,
  useUpdateMappingMutation,
} from "../api/services/mappings.js";
import { useToast } from "../hooks/useToast.js";
import { formatApiError } from "../lib/errors.js";

const CHANNEL_OPTIONS = [
  { value: "shopify", label: "Shopify" },
];

const EMPTY_FORM = { id: null, channel: "shopify", channelSku: "", itemCode: "" };

function MappingForm({ open, onOpenChange, mode, form, setForm, onSubmit, error, isSaving, items }) {
  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{mode === "edit" ? "Edit mapping" : "New mapping"}</SheetTitle>
          <SheetDescription>Link a channel SKU to the POS 2.0 item code it resolves to.</SheetDescription>
        </SheetHeader>
        <form id="mapping-form" className="flex flex-1 flex-col gap-4 px-4" onSubmit={onSubmit}>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="channel">Channel</Label>
            <Select id="channel" className="w-full" value={form.channel} onChange={set("channel")}>
              {CHANNEL_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="channelSku">Channel SKU</Label>
            <Input id="channelSku" value={form.channelSku} onChange={set("channelSku")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="itemCode">POS 2.0 item code</Label>
            <Select id="itemCode" className="w-full" value={form.itemCode} onChange={set("itemCode")}>
              <option value="" disabled>
                Select an item code
              </option>
              {items.map((item) => (
                <option key={item.itemCode} value={item.itemCode}>
                  {item.itemCode} — {item.title}
                </option>
              ))}
            </Select>
          </div>
        </form>
        <SheetFooter>
          <Button type="submit" form="mapping-form" disabled={isSaving || !form.itemCode}>
            {isSaving ? "Saving…" : mode === "edit" ? "Save changes" : "Create mapping"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default function MappingsList() {
  const { showToast } = useToast();
  const { data, isFetching, error, refetch } = useGetMappingsQuery();
  const { data: pool } = useGetInventoryPoolQuery();
  const [createMapping, { isLoading: isCreating }] = useCreateMappingMutation();
  const [updateMapping, { isLoading: isUpdating }] = useUpdateMappingMutation();
  const [deleteMapping, { isLoading: isDeleting }] = useDeleteMappingMutation();

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
    setForm({ id: row.id, channel: row.channel, channelSku: row.channelSku, itemCode: row.itemCode });
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);
    const payload = { channel: form.channel, channelSku: form.channelSku, itemCode: form.itemCode };
    try {
      if (formMode === "edit") {
        await updateMapping({ id: form.id, ...payload }).unwrap();
        showToast(`${form.channelSku} updated.`);
      } else {
        await createMapping(payload).unwrap();
        showToast(`${form.channelSku} mapped.`);
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(formatApiError(err));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMapping(deleteTarget.id).unwrap();
      showToast(`${deleteTarget.channelSku} unmapped.`);
      setDeleteTarget(null);
    } catch {
      // AlertDialog stays open on failure — dropdown already surfaces the toast/error path elsewhere.
    }
  };

  const COLUMNS = [
    { key: "channel", label: "Channel", render: (row) => <ChannelBadge channel={row.channel} /> },
    { key: "channelSku", label: "Channel SKU", mono: true },
    { key: "itemCode", label: "POS item code", mono: true },
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
          Item code is the universal key — this is what lets an order from any channel resolve to it.
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-3.5" />
          New mapping
        </Button>
      </div>
      <ListEyebrow count={data?.count ?? 0} noun="mappings" label="Managed in this admin" live={false} />
      <DataTable
        columns={COLUMNS}
        rows={data?.rows ?? []}
        loading={isFetching}
        error={formatApiError(error)}
        onRetry={refetch}
        empty={
          <EmptyState
            icon={Link2}
            title="No mappings yet"
            description="Create the first channel SKU → item code mapping to get started."
            action={
              <Button size="sm" variant="outline" onClick={openCreate}>
                New mapping
              </Button>
            }
          />
        }
      />

      <MappingForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        error={formError}
        isSaving={formMode === "edit" ? isUpdating : isCreating}
        items={pool?.rows ?? []}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete mapping for {deleteTarget?.channelSku}?</AlertDialogTitle>
            <AlertDialogDescription>
              Future orders on this SKU will drop into the Pending queue until it's mapped again.
            </AlertDialogDescription>
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
