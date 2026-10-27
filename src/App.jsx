import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

import AppLoadingSkeleton from "./components/AppLoadingSkeleton.jsx";
import { useAuth } from "./hooks/useAuth.js";
import ProtectedLayout from "./layouts/ProtectedLayout.jsx";
import PublicLayout from "./layouts/PublicLayout.jsx";
import { AuthProvider } from "./providers/AuthProvider.jsx";
import { canOpenPath } from "./lib/permissions.js";
import { ToastProvider } from "./providers/ToastProvider.jsx";
import Barcodes from "./screens/Barcodes.jsx";
import ActivityLog from "./screens/ActivityLog.jsx";
import ChannelProducts from "./screens/ChannelProducts.jsx";
import ChannelsList from "./screens/ChannelsList.jsx";
import Dashboard from "./screens/Dashboard.jsx";
import InventoryList from "./screens/InventoryList.jsx";
import LocationsList from "./screens/LocationsList.jsx";
import OrderDetail from "./screens/OrderDetail.jsx";
import FulfillmentLines from "./screens/FulfillmentLines.jsx";
import OrdersList from "./screens/OrdersList.jsx";
import ProductsList from "./screens/ProductsList.jsx";
import Profile from "./screens/Profile.jsx";
import Reports from "./screens/Reports.jsx";
import UnmappedSkus from "./screens/UnmappedSkus.jsx";
import UserManagement from "./screens/UserManagement.jsx";
import Login from "./screens/auth/Login.jsx";

// Holds every route back until the initial session check (stored token ->
// /me/ -> silent refresh if needed, see AuthProvider) settles, instead of
// flashing the login form or a protected screen that a moment later turns
// out to be the wrong one for the session that was actually restored.
function OpsRouteGuard() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  return canOpenPath(user, pathname) ? (
    <Outlet />
  ) : (
    <Navigate to="/fulfillments" replace />
  );
}

function AppRoutes() {
  const { isInitializing } = useAuth();
  if (isInitializing) return <AppLoadingSkeleton />;

  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/login" element={<Login />} />
      </Route>
      <Route element={<ProtectedLayout />}>
        <Route element={<OpsRouteGuard />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders" element={<OrdersList />} />
          <Route path="/fulfillments" element={<FulfillmentLines />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/catalog/products" element={<ProductsList />} />
          <Route path="/catalog/inventory" element={<InventoryList />} />
          <Route path="/catalog/barcodes" element={<Barcodes />} />
          <Route
            path="/catalog/channel-products"
            element={<ChannelProducts />}
          />
          <Route path="/catalog/unmapped" element={<UnmappedSkus />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings/locations" element={<LocationsList />} />
          <Route path="/settings/channels" element={<ChannelsList />} />
          <Route path="/settings/activity" element={<ActivityLog />} />
          <Route path="/settings/profile" element={<Profile />} />
          <Route path="/settings/users" element={<UserManagement />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ToastProvider>
  );
}
