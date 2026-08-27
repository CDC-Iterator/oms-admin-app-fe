import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { AppSidebar } from "@/components/app-sidebar.jsx";
import { Separator } from "@/components/ui/separator.jsx";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar.jsx";
import { useAuth } from "@/hooks/useAuth.js";

const PAGE_TITLES = {
  "/": "Dashboard",
  "/orders": "Orders",
  "/pending": "Pending Orders",
  "/inventory": "Inventory",
  "/mappings": "SKU / ID Mappings",
  "/channels": "Channels",
  "/locations": "Locations",
  "/activity": "Activity Log",
  "/reports": "Reports",
  "/fulfillments": "Fulfillments",
  "/customers": "Customers",
  "/users": "Users",
  "/allocation": "Allocation Rules",
};

function PageTitle() {
  const { pathname } = useLocation();
  // Exact match first (covers every list screen); fall back to the longest
  // matching prefix for nested routes like /orders/:id or /allocation/preview.
  const title =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES)
      .filter(([path]) => path !== "/" && pathname.startsWith(path))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ??
    "CDC OMS";
  return <h1 className="font-heading text-sm font-semibold">{title}</h1>;
}

/**
 * Frame + auth gate for every logged-in screen: the shadcn sidebar shell
 * (moved here from App.jsx) wrapping <Outlet/>, redirecting to /login the
 * moment there's no session so the sidebar never flashes for a visitor
 * who isn't signed in.
 */
export default function ProtectedLayout() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      {/* h-svh + overflow-hidden turns this into the one fixed-height frame for
          everything right of the sidebar, so the header below can stay put
          (shrink-0, never scrolls) while the content div underneath — the
          only element with overflow-y-auto — is the single scroll region.
          Previously neither had a height constraint, so the whole document
          scrolled and the header scrolled away with it. */}
      <SidebarInset className="h-svh overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <PageTitle />
        </header>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
