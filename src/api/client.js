import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  // The refresh token rides an httpOnly cookie (Django sets it on login,
  // scoped to /api/auth/) — this is what makes the browser send it back.
  withCredentials: true,
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
