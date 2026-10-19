import { useMemo } from "react";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useSearchParams } from "react-router-dom";

// Column sort/filter state for a server-paginated list, kept in the URL.
// Column ids are the backend's ?ordering= keys; `meta.filterParam` names a column's filter param.
export function useServerColumns({ columns, defaultOrdering }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const ordering = searchParams.get("ordering") || defaultOrdering;
  const filterColumns = useMemo(() => columns.filter((c) => c.meta?.filterParam), [columns]);

  const update = (updates) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries({ ...updates, page: null })) {
          if (value === null || value === undefined || value === "") next.delete(key);
          else next.set(key, String(value));
        }
        return next;
      },
      { replace: true }
    );

  const sorting = useMemo(() => [{ id: ordering.replace(/^-/, ""), desc: ordering.startsWith("-") }], [ordering]);
  const columnFilters = filterColumns
    .map((c) => ({ id: c.id, value: searchParams.get(c.meta.filterParam) || "" }))
    .filter((f) => f.value);

  const table = useReactTable({
    data: [],
    columns,
    state: { sorting, columnFilters },
    manualSorting: true,
    manualFiltering: true,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: (updater) => {
      const [next] = typeof updater === "function" ? updater(sorting) : updater;
      update({ ordering: next ? (next.desc ? "-" : "") + next.id : null });
    },
    onColumnFiltersChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnFilters) : updater;
      update(Object.fromEntries(filterColumns.map((c) => [c.meta.filterParam, next.find((f) => f.id === c.id)?.value ?? null])));
    },
  });

  // Query params for the list request — `undefined` drops a param from the URL.
  const filterParams = Object.fromEntries(filterColumns.map((c) => [c.meta.filterParam, searchParams.get(c.meta.filterParam) || undefined]));
  return {
    table,
    orderingParam: ordering === defaultOrdering ? undefined : ordering,
    filterParams,
    activeFilters: columnFilters.length,
    clearFilters: () => update(Object.fromEntries(filterColumns.map((c) => [c.meta.filterParam, null]))),
  };
}
