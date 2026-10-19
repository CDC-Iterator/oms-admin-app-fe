import { useState } from "react";
import { Package } from "lucide-react";

import { cn } from "@/lib/utils.js";

/** Product thumbnail — the channel's product image, or a neutral box when it has none or fails to load. */
export function ProductThumb({ src, alt = "", className }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("size-10 shrink-0 rounded-md object-cover ring-1 ring-border", className)}
    />
  ) : (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground ring-1 ring-border",
        className
      )}
    >
      <Package className="size-4" />
    </span>
  );
}

/** An order line's product: image, title (wraps to two lines) and variant, with the SKU underneath.
 *  `layout="card"` is the roomier Shopify-style row: bigger thumbnail, variant and SKU as chips. */
export function LineProduct({ line, showSku = true, layout = "compact", children }) {
  if (layout === "card") {
    return (
      <div className="flex min-w-0 flex-1 items-start gap-3 font-sans">
        <ProductThumb src={line.image_url} alt={line.title} className="size-9 rounded-md" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 break-words text-sm font-semibold leading-snug" title={line.title}>
            {line.title || line.external_sku || "Untitled product"}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {line.variant_title && (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium">{line.variant_title}</span>
            )}
            {showSku && line.external_sku && (
              <span className="font-mono text-xs text-muted-foreground">{line.external_sku}</span>
            )}
            {children}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-1 items-start gap-2.5 font-sans">
      <ProductThumb src={line.image_url} alt={line.title} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 break-words text-sm font-medium leading-snug" title={line.title}>
          {line.title || line.external_sku || "Untitled product"}
        </p>
        {line.variant_title && <p className="truncate text-xs text-muted-foreground">{line.variant_title}</p>}
        {showSku && line.external_sku && (
          <p className="truncate font-mono text-[0.65rem] text-muted-foreground">{line.external_sku}</p>
        )}
        {children}
      </div>
    </div>
  );
}
