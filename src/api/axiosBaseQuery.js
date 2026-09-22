import client from "./client.js";
import { logout, setCredentials } from "./slices/authSlice.js";

// Shared across every createApi() slice (they all import this one instance,
// see baseQuery.js) so concurrent 401s dedupe onto a single refresh call.
let refreshPromise = null;

function refreshAccessToken(dispatch) {
  if (!refreshPromise) {
    refreshPromise = client
      .post("/api/auth/refresh/")
      .then((res) => {
        dispatch(setCredentials({ access: res.data.access }));
        return res.data.access;
      })
      .catch((err) => {
        dispatch(logout());
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/**
 * RTK Query base query backed by the shared axios instance (see client.js —
 * baseURL, ngrok header, credentials). Injects the staff JWT access token
 * from the auth slice on every request, and on a 401 (access token expired)
 * transparently refreshes once via the httpOnly cookie and retries — unless
 * the failing call is itself an /api/auth/ call, to avoid looping. Unlike the
 * reference app's axiosBaseQuery, this doesn't register a new axios
 * interceptor per call (those accumulate for the app's whole lifetime) — the
 * header is just merged into this one request's config.
 */
const axiosBaseQuery =
  () =>
  async ({ url, method, body, params, ...requestOpts }, { getState, dispatch }) => {
    const request = (token) =>
      client({
        url,
        method,
        data: body,
        params,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...requestOpts.headers,
        },
        responseType: requestOpts.responseType,
      });

    const token = getState()?.auth?.accessToken;
    try {
      const result = await request(token);
      return { data: result.data };
    } catch (axiosError) {
      const status = axiosError.response?.status;
      const isAuthEndpoint = url?.startsWith("/api/auth/");
      if (status === 401 && token && !isAuthEndpoint) {
        try {
          const newToken = await refreshAccessToken(dispatch);
          const retryResult = await request(newToken);
          return { data: retryResult.data };
        } catch {
          // Refresh failed too — fall through and report the original 401.
        }
      }
      return {
        error: {
          status: axiosError.response?.status,
          data: axiosError.response?.data || axiosError.message,
        },
      };
    }
  };

export default axiosBaseQuery();
