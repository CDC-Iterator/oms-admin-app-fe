import { ChevronDown, ChevronLeft, ChevronUp, Copy, Inbox } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button.jsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.jsx";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb.jsx";
import { useToast } from "../hooks/useToast.js";

/** Shopify-style order top bar: round back button, "Orders / #name" breadcrumb, a "More actions" menu and
 *  previous/next order arrows (shown only when the page was opened from the list, which knows the neighbours). */
export function OrderAppBar({ order, onBack, onPrev, onNext, actions = [] }) {
  const { showToast } = useToast();
  const name = order.order_name || order.external_order_id;

  const copy = async (text, what) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${what} copied`);
    } catch {
      showToast("Couldn't copy to the clipboard", true);
    }
  };

  return (
    <div className="mb-4 flex items-center gap-3">
      <Button variant="outline" size="icon" className="rounded-full" onClick={onBack} aria-label="Back to orders">
        <ChevronLeft className="size-4" />
      </Button>

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <Link to="/orders" className="inline-flex items-center gap-1.5 hover:text-foreground">
              <Inbox className="size-4" />
              Orders
            </Link>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-medium">{name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="rounded-full" />}>
            More actions
            <ChevronDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuItem onClick={() => copy(name, "Order number")}>
              <Copy />
              Copy order number
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => copy(String(order.external_order_id), "Order ID")}>
              <Copy />
              Copy channel order ID
            </DropdownMenuItem>
            {actions.length > 0 && <DropdownMenuSeparator />}
            {actions.map((a) => (
              <DropdownMenuItem
                key={a.key}
                variant={a.destructive ? "destructive" : "default"}
                disabled={a.disabled}
                onClick={a.onSelect}
              >
                {a.icon && <a.icon />}
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {(onPrev || onNext) && (
          <div className="flex items-center overflow-hidden rounded-full ring-1 ring-border">
            <Button variant="ghost" size="icon-sm" className="rounded-none" disabled={!onPrev} onClick={onPrev} aria-label="Previous order">
              <ChevronUp className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" className="rounded-none" disabled={!onNext} onClick={onNext} aria-label="Next order">
              <ChevronDown className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
