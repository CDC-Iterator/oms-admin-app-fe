import client from "./client.js";

/**
 * RTK Query base query backed by the shared axios instance (see client.js —
 * baseURL, ngrok header, dev X-Shop-Domain header). Injects the staff JWT
 * access token from the auth slice on every request. Unlike the reference
 * app's axiosBaseQuery, this doesn't register a new axios interceptor per
 * call (those accumulate for the app's whole lifetime) — the header is
 * just merged into this one request's config.
 */
const axiosBaseQuery =
  () =>
  async ({ url, method, body, params, ...requestOpts }, { getState }) => {
    const token = getState()?.auth?.accessToken;
    try {
      const result = await client({
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
      return { data: result.data };
    } catch (axiosError) {
      const err = axiosError;
      return {
        error: {
          status: err.response?.status,
          data: err.response?.data || err.message,
        },
      };
    }
  };

export default axiosBaseQuery();
