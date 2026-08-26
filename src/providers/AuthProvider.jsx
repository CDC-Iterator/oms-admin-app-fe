import { createContext, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { authApi, useGetMeQuery, useLogoutMutation } from "@/api/services/auth.js";
import { customersApi } from "@/api/services/customers.js";
import { fulfillmentsApi } from "@/api/services/fulfillments.js";
import { inventoryApi } from "@/api/services/inventory.js";
import { ordersApi } from "@/api/services/orders.js";
import { statsApi } from "@/api/services/stats.js";
import { usersApi } from "@/api/services/users.js";
import { logout as logoutAction, setUser } from "@/api/slices/authSlice.js";

export const AuthContext = createContext(undefined);

/**
 * Tracks the staff session and exposes { isAuthenticated, user, handleLogout }
 * to ProtectedLayout/PublicLayout/AppSidebar. Unlike the reference app there
 * is no refresh-cookie to silently exchange on mount — a stored access token
 * (see authSlice/store.js) either still works or the /me check below fails
 * and the session is dropped.
 */
export function AuthProvider({ children }) {
  const dispatch = useDispatch();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const refreshToken = useSelector((state) => state.auth.refreshToken);
  const user = useSelector((state) => state.auth.user);
  const [logoutMutation] = useLogoutMutation();

  const { data: me, isError } = useGetMeQuery(undefined, { skip: !accessToken });

  useEffect(() => {
    if (me) dispatch(setUser(me));
  }, [me, dispatch]);

  useEffect(() => {
    // Stored token turned out to be invalid/expired — drop the session
    // instead of leaving the app stuck showing a stale "authenticated" state.
    if (accessToken && isError) {
      dispatch(logoutAction());
    }
  }, [accessToken, isError, dispatch]);

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await logoutMutation({ refresh: refreshToken }).unwrap();
      }
    } catch {
      // Already invalid/expired — fine, we're clearing local state anyway.
    } finally {
      dispatch(logoutAction());
      dispatch(authApi.util.resetApiState());
      dispatch(usersApi.util.resetApiState());
      dispatch(ordersApi.util.resetApiState());
      dispatch(inventoryApi.util.resetApiState());
      dispatch(fulfillmentsApi.util.resetApiState());
      dispatch(customersApi.util.resetApiState());
      dispatch(statsApi.util.resetApiState());
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated: Boolean(accessToken), user, handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}
