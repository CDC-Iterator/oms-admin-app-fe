import * as React from "react";
import {
  Boxes,
  LayoutDashboard,
  LogOut,
  PackageSearch,
  Receipt,
  Truck,
  UserCog,
  Users,
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
  { title: "Inventory", url: "/inventory", icon: Boxes },
  { title: "Fulfillments", url: "/fulfillments", icon: Truck },
  { title: "Customers", url: "/customers", icon: Users },
];

// /api/users/ is IsAdminUser-only on the backend — hide the link rather
// than send non-staff accounts to a screen that will just 403.
const ADMIN_NAV_ITEMS = [{ title: "Users", url: "/users", icon: UserCog }];

function NavItems({ items, pathname }) {
  return items.map((item) => {
    const isActive = item.url === "/" ? pathname === "/" : pathname.startsWith(item.url);
    const Icon = item.icon;
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton isActive={isActive} render={<NavLink to={item.url} />}>
          <Icon className="size-4" strokeWidth={2} />
          <span>{item.title}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  });
}

export function AppSidebar({ ...props }) {
  const location = useLocation();
  const { user, handleLogout } = useAuth();

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <PackageSearch className="size-4" strokeWidth={2} />
          </div>
          <div className="flex flex-col leading-none">
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
        {user?.is_staff && (
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
            <div className="flex items-center justify-between gap-2 px-2 py-1">
              <span className="truncate text-xs text-muted-foreground">
                {user?.username || "Signed in"}
              </span>
              <SidebarMenuButton
                className="w-auto shrink-0 px-1.5"
                onClick={handleLogout}
                aria-label="Sign out"
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
