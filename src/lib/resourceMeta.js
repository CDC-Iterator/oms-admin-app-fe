// Fills a table's column definitions with the sorts and filters the backend says its list endpoint accepts
// (GET /api/meta/resources/<key>/). A column declares only how it looks; until the metadata arrives it has none.
export function columnsFromMeta(columns, meta) {
  const sortable = new Set(meta?.sorts ?? []);
  const filters = new Map((meta?.filters ?? []).filter((f) => f.column).map((f) => [f.column, f]));
  return columns.map((column) => {
    const filter = filters.get(column.id);
    const filterMeta = !filter
      ? {}
      : filter.type === "daterange"
        ? { filterDateRange: true, filterParam: filter.param }
        : { filterOptions: filter.choices, filterParam: filter.param };
    return { ...column, enableSorting: sortable.has(column.id), meta: { ...column.meta, ...filterMeta } };
  });
}
