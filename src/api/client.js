import axios from "axios";

// The backend resolves the calling merchant from this header while
// ALLOW_DEV_AUTH=True (see merchants/authentication.py). Swap for real
// session auth once a login flow exists.
const DEV_SHOP_DOMAIN = import.meta.env.VITE_DEV_SHOP_DOMAIN || "";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    // Bypasses ngrok's free-tier browser-warning interstitial (ERR_NGROK_6024),
    // which otherwise answers browser-UA requests with an HTML page carrying no
    // CORS headers — the backend never even sees the request. Harmless to send
    // when VITE_API_BASE_URL isn't an ngrok URL; any other server just ignores
    // this unrecognized header.
    "ngrok-skip-browser-warning": "true",
    ...(DEV_SHOP_DOMAIN ? { "X-Shop-Domain": DEV_SHOP_DOMAIN } : {}),
  },
});

export default client;
