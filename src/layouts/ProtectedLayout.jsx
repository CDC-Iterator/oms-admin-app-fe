import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { AppSidebar } from "@/components/app-sidebar.jsx";
import { Separator } from "@/components/ui/separator.jsx";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar.jsx";
import { useAuth } from "@/hooks/useAuth.js";

const PAGE_TITLES = {
  "/": "Dashboard",
  "/orders": "Orders",
  "/inventory": "Inventory",
  "/fulfillments": "Fulfillments",
  "/customers": "Customers",
  "/users": "Users",
};

function PageTitle() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] || "CDC OMS";
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
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <PageTitle />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
