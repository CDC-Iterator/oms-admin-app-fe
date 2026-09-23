import { Route, Routes } from "react-router-dom";

import ProtectedLayout from "./layouts/ProtectedLayout.jsx";
import PublicLayout from "./layouts/PublicLayout.jsx";
import { AuthProvider } from "./providers/AuthProvider.jsx";
import { ToastProvider } from "./providers/ToastProvider.jsx";
import ActivityLog from "./screens/ActivityLog.jsx";
import ChannelProducts from "./screens/ChannelProducts.jsx";
import ChannelsList from "./screens/ChannelsList.jsx";
import Dashboard from "./screens/Dashboard.jsx";
import InventoryList from "./screens/InventoryList.jsx";
import LocationsList from "./screens/LocationsList.jsx";
import OrderDetail from "./screens/OrderDetail.jsx";
import OrdersList from "./screens/OrdersList.jsx";
import ProductsList from "./screens/ProductsList.jsx";
import Profile from "./screens/Profile.jsx";
import Reports from "./screens/Reports.jsx";
import UnmappedSkus from "./screens/UnmappedSkus.jsx";
import UserManagement from "./screens/UserManagement.jsx";
import Login from "./screens/auth/Login.jsx";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/login" element={<Login />} />
          </Route>
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<OrdersList />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/catalog/products" element={<ProductsList />} />
            <Route path="/catalog/inventory" element={<InventoryList />} />
            <Route path="/catalog/channel-products" element={<ChannelProducts />} />
            <Route path="/catalog/unmapped" element={<UnmappedSkus />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings/locations" element={<LocationsList />} />
            <Route path="/settings/channels" element={<ChannelsList />} />
            <Route path="/settings/activity" element={<ActivityLog />} />
            <Route path="/settings/profile" element={<Profile />} />
            <Route path="/settings/users" element={<UserManagement />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}
