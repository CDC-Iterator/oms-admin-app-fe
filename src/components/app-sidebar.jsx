import * as React from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Boxes,
  LayoutDashboard,
  Link2,
  LogOut,
  PackageSearch,
  Radio,
  Receipt,
  SlidersHorizontal,
  Truck,
  UserCog,
  Users,
  Warehouse,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth.js";

// Our real routes — one flat group, replacing the sidebar-01 block's
// Next.js-docs sample data (Getting Started / Build Your Application / ...).
const NAV_ITEMS = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Orders", url: "/orders", icon: Receipt },
  { title: "Pending", url: "/pending", icon: AlertCircle },
  { title: "Inventory", url: "/inventory", icon: Boxes },
  { title: "Mappings", url: "/mappings", icon: Link2 },
  { title: "Channels", url: "/channels", icon: Radio },
  { title: "Locations", url: "/locations", icon: Warehouse },
  { title: "Activity", url: "/activity", icon: Activity },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Fulfillments", url: "/fulfillments", icon: Truck },
  { title: "Customers", url: "/customers", icon: Users },
];

// Admin-only: hide these links from Fulfilment/Reporting accounts rather than
// send them to a screen their role has no business writing to.
const ADMIN_NAV_ITEMS = [
  { title: "Users", url: "/users", icon: UserCog },
  { title: "Allocation Rules", url: "/allocation", icon: SlidersHorizontal, scope: true },
];

function NavItems({ items, pathname }) {
  return items.map((item) => {
    const isActive = item.url === "/" ? pathname === "/" : pathname.startsWith(item.url);
    const Icon = item.icon;
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton isActive={isActive} render={<NavLink to={item.url} />} tooltip={item.title}>
          <Icon className="size-4" strokeWidth={2} />
          <span className="flex-1">{item.title}</span>
          {item.scope && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">
              Scope
            </span>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  });
}

export function AppSidebar({ ...props }) {
  const location = useLocation();
  const { user, handleLogout } = useAuth();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <PackageSearch className="size-4" strokeWidth={2} />
          </div>
          <div className="flex flex-col leading-none group-data-[collapsible=icon]:hidden">
            <span className="font-heading text-sm font-semibold">CDC OMS</span>
            <span className="text-[11px] text-muted-foreground">Order ops</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItems items={NAV_ITEMS} pathname={location.pathname} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {user?.role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <NavItems items={ADMIN_NAV_ITEMS} pathname={location.pathname} />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <span className="truncate text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                {user?.username || "Signed in"}
              </span>
              <SidebarMenuButton
                className="w-auto shrink-0 px-1.5"
                onClick={handleLogout}
                aria-label="Sign out"
                tooltip="Sign out"
              >
                <LogOut className="size-4" strokeWidth={2} />
              </SidebarMenuButton>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
