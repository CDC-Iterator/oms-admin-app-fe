import { createContext, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { omsApi } from "@/api/omsApiBase.js";
import { authApi, useGetMeQuery, useLogoutMutation, useRefreshMutation } from "@/api/services/auth.js";
import { logout as logoutAction, setCredentials, setUser } from "@/api/slices/authSlice.js";

export const AuthContext = createContext(undefined);

/**
 * Tracks the staff session and exposes { isAuthenticated, user, handleLogout,
 * isInitializing } to ProtectedLayout/PublicLayout/AppSidebar. The access
 * token lives only in the Redux store (authSlice.js) — never localStorage/
 * sessionStorage — so every fresh page load starts with none in memory and
 * has to earn one back from the httpOnly refresh cookie via the boot effect
 * below, before falling back to "no session" if that cookie's gone too.
 *
 * `isInitializing` covers that whole boot round trip (refresh, then /me/ to
 * populate `user`) — lets callers hold off rendering instead of flashing
 * the login form or a protected screen a moment before the real answer.
 */
export function AuthProvider({ children }) {
  const dispatch = useDispatch();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const user = useSelector((state) => state.auth.user);
  const [logoutMutation] = useLogoutMutation();
  const [refresh] = useRefreshMutation();

  const [bootDone, setBootDone] = useState(false);
  useEffect(() => {
    let cancelled = false;
    refresh()
      .unwrap()
      .then((res) => {
        if (!cancelled) dispatch(setCredentials({ access: res.access }));
      })
      .catch(() => {
        // No valid refresh cookie — genuinely logged out, nothing to do.
      })
      .finally(() => {
        if (!cancelled) setBootDone(true);
      });
    return () => {
      cancelled = true;
    };
    // Boot-once: refresh/dispatch identities are stable, re-running this on
    // every render would spam the refresh endpoint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: me, isLoading: meLoading, isError } = useGetMeQuery(undefined, {
    skip: !bootDone || !accessToken,
  });
  // Stay "initializing" through the render where /me/ has just failed but
  // the logout effect below hasn't cleared accessToken yet — otherwise
  // that one frame renders with isInitializing false and the stale
  // (about-to-be-revoked) accessToken still truthy.
  const isInitializing = !bootDone || (Boolean(accessToken) && (meLoading || isError));

  useEffect(() => {
    if (me) dispatch(setUser(me));
  }, [me, dispatch]);

  useEffect(() => {
    // Access token turned out to be invalid/expired — drop the session
    // instead of leaving the app stuck showing a stale "authenticated" state.
    if (accessToken && isError) {
      dispatch(logoutAction());
    }
  }, [accessToken, isError, dispatch]);

  const handleLogout = async () => {
    try {
      await logoutMutation().unwrap();
    } catch {
      // Already invalid/expired — fine, we're clearing local state anyway.
    } finally {
      dispatch(logoutAction());
      dispatch(authApi.util.resetApiState());
      // Covers orders/inventory/catalog/unmapped/channels/locations/activity/
      // reports/allocation — they all share the omsApi cache.
      dispatch(omsApi.util.resetApiState());
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated: Boolean(accessToken), user, handleLogout, isInitializing }}>
      {children}
    </AuthContext.Provider>
  );
}
