import { useSearchParams } from "react-router-dom";

import { EmptyState } from "@/components/empty-state.jsx";
import { ScopeBanner } from "@/components/ScopeBanner.jsx";
import { StatusBadge } from "@/components/status-badge.jsx";
import { Select } from "@/components/ui/select.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { useGetAllocationPreviewQuery } from "../api/services/allocation.js";
import { useGetInventoryPoolQuery } from "../api/services/inventory.js";

export default function AllocationPreview() {
  const [params, setParams] = useSearchParams();
  const itemCode = params.get("item") || "";

  const { data: pool } = useGetInventoryPoolQuery();
  const { data: preview, isFetching } = useGetAllocationPreviewQuery(itemCode, { skip: !itemCode });

  const items = pool?.rows ?? [];

  return (
    <div>
      <ScopeBanner>
        For an item code with multiple units, this ranks them by the current allocation rules and
        highlights which one POS 2.0 would be told to reserve. Preview only — no reservation happens
        from this screen.
      </ScopeBanner>

      <div className="mb-4">
        <Select
          value={itemCode}
          onChange={(e) => setParams(e.target.value ? { item: e.target.value } : {})}
        >
          <option value="">Choose an item code…</option>
          {items.map((item) => (
            <option key={item.itemCode} value={item.itemCode}>
              {item.itemCode} — {item.title} ({item.available} available)
            </option>
          ))}
        </Select>
      </div>

      {!itemCode ? (
        <EmptyState title="Pick an item code" description="Choose a multi-unit item to see the recommended serial." />
      ) : isFetching ? (
        <Skeleton className="h-48 w-full" />
      ) : !preview || preview.serials.length === 0 ? (
        <EmptyState title="No available units" description="Every unit of this item is already reserved." />
      ) : (
        <>
          <p className="mb-2 text-sm text-muted-foreground">
            Ranked by: {preview.rules.map((r) => r.label).join(" → ")}
          </p>
          // Not overflow-hidden — would trap TableHeader's sticky positioning
          // inside this div instead of the page's real scroll region.
          <div className="rounded-xl ring-1 ring-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Rank</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Ownership</TableHead>
                  <TableHead>Purchase price</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.serials.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono tabular-nums">{s.rank}</TableCell>
                    <TableCell className="font-mono">{s.barcode}</TableCell>
                    <TableCell className="capitalize">{s.ownership}</TableCell>
                    <TableCell className="font-mono tabular-nums">
                      ₹{s.purchasePrice.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell>
                      {s.location?.name} <span className="text-muted-foreground">({s.location?.zone})</span>
                    </TableCell>
                    <TableCell>
                      {s.recommended && <StatusBadge tone="success">Recommended</StatusBadge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
