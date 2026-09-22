import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";

import { omsApi } from "./omsApiBase.js";
import { authApi } from "./services/auth.js";
import authReducer, { AUTH_STORAGE_KEY } from "./slices/authSlice.js";

// The individual OMS domain files (services/orders.js, inventory.js,
// unmapped.js, channels.js, locations.js, activity.js, catalog.js,
// reports.js, allocation.js) all call omsApi.injectEndpoints — they
// don't need a line here, just an import somewhere before their hooks are
// used, which happens naturally wherever a screen imports the hook it needs.

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [authApi.reducerPath]: authApi.reducer,
    [omsApi.reducerPath]: omsApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(authApi.middleware, omsApi.middleware),
});

setupListeners(store.dispatch);

// Persist the auth slice to localStorage on every change, so a reload keeps
// the session. Done here (outside the reducer) to keep authSlice's reducers
// pure — the stored access token is just a head start; a missing/expired one
// is silently recovered from the httpOnly refresh cookie (axiosBaseQuery.js).
let lastAuth = store.getState().auth;
store.subscribe(() => {
  const auth = store.getState().auth;
  if (auth === lastAuth) return;
  lastAuth = auth;
  try {
    if (auth.accessToken) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable (private mode, etc.) — session just won't
    // survive a reload.
  }
});
