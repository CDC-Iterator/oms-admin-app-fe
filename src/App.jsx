import { Route, Routes } from "react-router-dom";

import ProtectedLayout from "./layouts/ProtectedLayout.jsx";
import PublicLayout from "./layouts/PublicLayout.jsx";
import { AuthProvider } from "./providers/AuthProvider.jsx";
import { ToastProvider } from "./providers/ToastProvider.jsx";
import CustomersList from "./screens/CustomersList.jsx";
import Dashboard from "./screens/Dashboard.jsx";
import FulfillmentsList from "./screens/FulfillmentsList.jsx";
import InventoryList from "./screens/InventoryList.jsx";
import OrdersList from "./screens/OrdersList.jsx";
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
            <Route path="/inventory" element={<InventoryList />} />
            <Route path="/fulfillments" element={<FulfillmentsList />} />
            <Route path="/customers" element={<CustomersList />} />
            <Route path="/users" element={<UsersList />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}
