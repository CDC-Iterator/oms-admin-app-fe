import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";

import { omsApi } from "./omsApiBase.js";
import { authApi } from "./services/auth.js";
import { customersApi } from "./services/customers.js";
import { fulfillmentsApi } from "./services/fulfillments.js";
import { usersApi } from "./services/users.js";
import authReducer, { AUTH_STORAGE_KEY } from "./slices/authSlice.js";

// The individual OMS domain files (services/orders.js, inventory.js,
// mappings.js, pending.js, channels.js, locations.js, activity.js,
// reports.js, stats.js, allocation.js) all call omsApi.injectEndpoints — they
// don't need a line here, just an import somewhere before their hooks are
// used, which happens naturally wherever a screen imports the hook it needs.

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [authApi.reducerPath]: authApi.reducer,
    [usersApi.reducerPath]: usersApi.reducer,
    [omsApi.reducerPath]: omsApi.reducer,
    [fulfillmentsApi.reducerPath]: fulfillmentsApi.reducer,
    [customersApi.reducerPath]: customersApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      authApi.middleware,
      usersApi.middleware,
      omsApi.middleware,
      fulfillmentsApi.middleware,
      customersApi.middleware
    ),
});

setupListeners(store.dispatch);

// Persist the auth slice to localStorage on every change, so a reload keeps
// the session. Done here (outside the reducer) to keep authSlice's reducers
// pure — there's no refresh-cookie to re-hydrate from on mount, unlike the
// Polaris reference app, so the stored access token itself is the session.
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
