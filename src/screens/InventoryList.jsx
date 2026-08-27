import { Fragment, useState } from "react";
import { Boxes, ChevronDown, ChevronRight } from "lucide-react";

import { EmptyState } from "../components/empty-state.jsx";
import { ListEyebrow } from "../components/list-eyebrow.jsx";
import { StatusBadge } from "../components/status-badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { useGetInventoryPoolQuery, useGetSerialsQuery } from "../api/services/inventory.js";
import { formatApiError } from "../lib/errors.js";
import { stockLevel } from "../lib/status.js";

const SKELETON_ROWS = 6;
const HEADERS = ["", "Item code / title", "Category", "Available", "Level", "Listed on"];

function SerialsPanel({ itemCode }) {
  const { data, isFetching, error } = useGetSerialsQuery(itemCode);
  const rows = data?.rows ?? [];

  if (isFetching) return <Skeleton className="h-16 w-full" />;
  if (error) return <p className="text-sm text-destructive">{formatApiError(error)}</p>;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No serials recorded.</p>;

  return (
    <div className="overflow-hidden rounded-lg ring-1 ring-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-8 text-[0.65rem]">Barcode</TableHead>
            <TableHead className="h-8 text-[0.65rem]">Ownership</TableHead>
            <TableHead className="h-8 text-[0.65rem]">Purchase price</TableHead>
            <TableHead className="h-8 text-[0.65rem]">Location</TableHead>
            <TableHead className="h-8 text-[0.65rem]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-mono text-xs tabular-nums">{s.barcode}</TableCell>
              <TableCell className="text-xs capitalize">{s.ownership}</TableCell>
              <TableCell className="font-mono text-xs tabular-nums">
                ₹{s.purchasePrice?.toLocaleString("en-IN")}
              </TableCell>
              <TableCell className="text-xs">
                {s.location?.name} <span className="text-muted-foreground">({s.location?.zone})</span>
              </TableCell>
              <TableCell>
                <StatusBadge tone={s.status === "available" ? "success" : "neutral"}>{s.status}</StatusBadge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function InventoryList() {
  const { data, isFetching, error, refetch } = useGetInventoryPoolQuery();
  const [expanded, setExpanded] = useState(() => new Set());

  const toggle = (itemCode) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(itemCode) ? next.delete(itemCode) : next.add(itemCode);
      return next;
    });
  };

  const rows = data?.rows ?? [];

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        One honest available number per item code, across every channel — expand a row for the
        individual serials behind it.
      </p>
      <ListEyebrow count={data?.count ?? 0} noun="items" />

      {error ? (
        <EmptyState
          tone="danger"
          title="Couldn't load inventory"
          description={`${formatApiError(error)} — check that the backend is reachable, then try again.`}
          action={
            <Button size="sm" variant="outline" onClick={refetch}>
              Try again
            </Button>
          }
        />
      ) : !isFetching && rows.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No items yet"
          description="Item-code stock will appear here once the pool is populated."
        />
      ) : (
        // Not overflow-hidden — would trap TableHeader's sticky positioning
        // inside this div instead of the page's real scroll region.
        <div className="rounded-xl ring-1 ring-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {HEADERS.map((h) => (
                  <TableHead
                    key={h}
                    className="h-10 font-mono text-[0.6875rem] font-medium tracking-wider text-muted-foreground uppercase"
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFetching
                ? Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      {HEADERS.map((h) => (
                        <TableCell key={h}>
                          <Skeleton className="h-4 w-full max-w-32" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : rows.map((item) => {
                    const isOpen = expanded.has(item.itemCode);
                    const level = stockLevel(item.available);
                    return (
                      <Fragment key={item.itemCode}>
                        <TableRow>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-expanded={isOpen}
                              onClick={() => toggle(item.itemCode)}
                            >
                              {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{item.title}</p>
                            <p className="font-mono text-xs text-muted-foreground">{item.itemCode}</p>
                          </TableCell>
                          <TableCell>{item.category}</TableCell>
                          <TableCell className="font-mono text-[13px] tabular-nums">
                            {item.available} / {item.total}
                          </TableCell>
                          <TableCell>
                            <StatusBadge tone={level.tone}>{level.label}</StatusBadge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {item.channels.join(", ")}
                          </TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={HEADERS.length} className="bg-muted/30 py-3">
                              <SerialsPanel itemCode={item.itemCode} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
