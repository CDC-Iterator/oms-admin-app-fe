/**
 * Unwraps DRF's `{count, results}` pagination envelope into the `{rows,
 * count}` shape the list screens consume — falls back to a bare array in
 * case pagination is ever turned off (same fallback the old useApiList hook
 * used). Shared `transformResponse` for every list-endpoint service.
 */
export function unwrapList(data) {
  if (Array.isArray(data)) {
    return { rows: data, count: data.length };
  }
  const rows = data?.results || [];
  return { rows, count: data?.count ?? rows.length };
}
