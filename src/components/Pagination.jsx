import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button.jsx";

/** [1, "…", 4, 5, 6, "…", 12] — always shows the first/last page, plus a
 * small window around the current page. */
function pageTokens(current, total) {
  const keep = new Set([1, total, current - 1, current, current + 1]);
  const tokens = [];
  let prev = null;
  for (let p = 1; p <= total; p++) {
    if (!keep.has(p)) continue;
    if (prev !== null && p - prev > 1) tokens.push("…");
    tokens.push(p);
    prev = p;
  }
  return tokens;
}

/** Numbered pagination — `page` is 1-indexed, matching DRF's PageNumberPagination `?page=`. */
export default function Pagination({ page, pageSize, count, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 pt-3">
      <p className="text-xs text-muted-foreground">
        Page {page} of {totalPages} · {count} total
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-3.5" />
        </Button>
        {pageTokens(page, totalPages).map((token, i) =>
          token === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={token}
              variant={token === page ? "default" : "outline"}
              size="icon-sm"
              className="font-mono tabular-nums"
              onClick={() => onPageChange(token)}
            >
              {token}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="icon-sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
