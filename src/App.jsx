import { Route, Routes } from "react-router-dom";

import ProtectedLayout from "./layouts/ProtectedLayout.jsx";
import PublicLayout from "./layouts/PublicLayout.jsx";
import { AuthProvider } from "./providers/AuthProvider.jsx";
import { ToastProvider } from "./providers/ToastProvider.jsx";
import ActivityLog from "./screens/ActivityLog.jsx";
import AllocationPreview from "./screens/AllocationPreview.jsx";
import AllocationRules from "./screens/AllocationRules.jsx";
import ChannelsList from "./screens/ChannelsList.jsx";
import CustomersList from "./screens/CustomersList.jsx";
import Dashboard from "./screens/Dashboard.jsx";
import FulfillmentsList from "./screens/FulfillmentsList.jsx";
import InventoryList from "./screens/InventoryList.jsx";
import LocationsList from "./screens/LocationsList.jsx";
import MappingsList from "./screens/MappingsList.jsx";
import OrderDetail from "./screens/OrderDetail.jsx";
import OrdersList from "./screens/OrdersList.jsx";
import PendingOrders from "./screens/PendingOrders.jsx";
import Reports from "./screens/Reports.jsx";
import UsersList from "./screens/UsersList.jsx";
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
            <Route path="/pending" element={<PendingOrders />} />
            <Route path="/inventory" element={<InventoryList />} />
            <Route path="/mappings" element={<MappingsList />} />
            <Route path="/channels" element={<ChannelsList />} />
            <Route path="/locations" element={<LocationsList />} />
            <Route path="/activity" element={<ActivityLog />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/fulfillments" element={<FulfillmentsList />} />
            <Route path="/customers" element={<CustomersList />} />
            <Route path="/users" element={<UsersList />} />
            <Route path="/allocation" element={<AllocationRules />} />
            <Route path="/allocation/preview" element={<AllocationPreview />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}
