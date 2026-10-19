import { Package } from "lucide-react";

import { cn } from "@/lib/utils.js";

/** Product thumbnail — the channel's product image, or a neutral box when it has none. */
export function ProductThumb({ src, alt = "", className }) {
  return src ? (
    <img
      src={src}
      alt={alt}
      loading="lazy"
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

/** An order line's product: image, title and variant (e.g. "M / Grey"), with the SKU underneath. */
export function LineProduct({ line, showSku = true }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <ProductThumb src={line.image_url} alt={line.title} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium" title={line.title}>
          {line.title || line.external_sku}
        </p>
        {line.variant_title && <p className="truncate text-xs text-muted-foreground">{line.variant_title}</p>}
        {showSku && line.external_sku && (
          <p className="truncate font-mono text-[0.65rem] text-muted-foreground">{line.external_sku}</p>
        )}
      </div>
    </div>
  );
}

/** Orders-list summary: up to three thumbnails, the first title, and a "+N more" count. */
export function OrderItemsSummary({ items = [] }) {
  if (items.length === 0) return <span className="text-muted-foreground">—</span>;
  const shown = items.slice(0, 3);
  const [first] = items;
  const extra = items.length - 1;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex shrink-0 -space-x-2">
        {shown.map((it) => (
          <ProductThumb key={it.id} src={it.image_url} alt={it.title} className="size-8 ring-2 ring-background" />
        ))}
      </div>
      <div className="min-w-0">
        <p className="max-w-52 truncate text-sm" title={first.title}>
          {first.title}
          {first.qty > 1 && <span className="text-muted-foreground"> × {first.qty}</span>}
        </p>
        {first.variant_title && <p className="max-w-52 truncate text-xs text-muted-foreground">{first.variant_title}</p>}
        {extra > 0 && <p className="text-xs text-muted-foreground">+{extra} more</p>}
      </div>
    </div>
  );
}
