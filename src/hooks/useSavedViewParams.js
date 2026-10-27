import { useSearchParams } from "react-router-dom";

// What a saved view captures on a list screen: its URL params (filters, ordering, tabs) minus the page,
// plus the search box. `apply` restores them.
export function useSavedViewParams({ search, setSearch }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = Object.fromEntries([...searchParams].filter(([key]) => key !== "page"));
  if (search) params.search = search;
  const apply = (saved) => {
    const { search: savedSearch, ...rest } = saved ?? {};
    setSearchParams(new URLSearchParams(Object.entries(rest).map(([k, v]) => [k, String(v)])), { replace: true });
    setSearch(savedSearch ? String(savedSearch) : "");
  };
  return { params, apply };
}
