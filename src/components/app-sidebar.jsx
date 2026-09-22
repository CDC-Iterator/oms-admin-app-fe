import * as React from "react";
import {
  Activity,
  BarChart3,
  Boxes,
  LayoutDashboard,
  Link2,
  LogOut,
  PackageSearch,
  Radio,
  Receipt,
  Tags,
  UserCircle,
  UserCog,
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

const NAV_ITEMS = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Orders", url: "/orders", icon: Receipt },
  { title: "Reports", url: "/reports", icon: BarChart3 },
];

const CATALOG_ITEMS = [
  { title: "Products", url: "/catalog/products", icon: Tags },
  { title: "Inventory", url: "/catalog/inventory", icon: Boxes },
  { title: "Unmapped SKUs", url: "/catalog/unmapped", icon: Link2 },
];

const SETTINGS_ITEMS = [
  { title: "Locations", url: "/settings/locations", icon: Warehouse },
  { title: "Channels", url: "/settings/channels", icon: Radio },
  { title: "Activity Log", url: "/settings/activity", icon: Activity },
];
const PROFILE_ITEMS = [{ title: "Profile", url: "/settings/profile", icon: UserCircle }];

// Shown to real superusers and business admins — the backend's own
// IsSuperAdmin gate on /api/users/ still applies, so a role="admin" user
// who isn't a Django superuser sees the item but gets a 403 on the API.
// Ordered above Profile, so it sits with the rest of Settings.
const USER_MANAGEMENT_ITEMS = [{ title: "Users", url: "/settings/users", icon: UserCog }];

function NavItems({ items, pathname }) {
  return items.map((item) => {
    const isActive = item.url === "/" ? pathname === "/" : pathname.startsWith(item.url);
    const Icon = item.icon;
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton isActive={isActive} render={<NavLink to={item.url} />} tooltip={item.title}>
          <Icon className="size-4" strokeWidth={2} />
          <span className="flex-1">{item.title}</span>
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
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItems items={NAV_ITEMS} pathname={location.pathname} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Catalog</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItems items={CATALOG_ITEMS} pathname={location.pathname} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItems items={SETTINGS_ITEMS} pathname={location.pathname} />
              {(user?.is_superuser || user?.role === "admin") && (
                <NavItems items={USER_MANAGEMENT_ITEMS} pathname={location.pathname} />
              )}
              <NavItems items={PROFILE_ITEMS} pathname={location.pathname} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
