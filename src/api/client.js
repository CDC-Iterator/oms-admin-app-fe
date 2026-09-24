import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  // Stateless by default — every request carries only the Authorization
  // header (see axiosBaseQuery.js). withCredentials is opted in per-request,
  // only for login/refresh/logout, which are the sole endpoints that set,
  // read, or clear the httpOnly refresh cookie.
  headers: {
    // Bypasses ngrok's free-tier browser-warning interstitial (ERR_NGROK_6024),
    // which otherwise answers browser-UA requests with an HTML page carrying no
    // CORS headers — the backend never even sees the request. Harmless to send
    // when VITE_API_BASE_URL isn't an ngrok URL; any other server just ignores
    // this unrecognized header.
    "ngrok-skip-browser-warning": "true",
  },
});

export default client;
