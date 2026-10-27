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
  // Picking a tab keeps what's typed in the search box unless the view carries its own search.
  const applyKeepingSearch = (saved) => apply(search && !saved?.search ? { ...saved, search } : saved);
  return { params, apply, applyKeepingSearch };
}
