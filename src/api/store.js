import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";

import { omsApi } from "./omsApiBase.js";
import { authApi } from "./services/auth.js";
import authReducer from "./slices/authSlice.js";

// The individual OMS domain files (services/orders.js, inventory.js,
// unmapped.js, channels.js, locations.js, activity.js, catalog.js,
// reports.js, allocation.js) all call omsApi.injectEndpoints — they
// don't need a line here, just an import somewhere before their hooks are
// used, which happens naturally wherever a screen imports the hook it needs.

// No localStorage persistence for the auth slice on purpose — the access
// token is memory-only (see authSlice.js); a reload starts from nothing and
// AuthProvider re-derives it from the httpOnly refresh cookie.
export const store = configureStore({
  reducer: {
    auth: authReducer,
    [authApi.reducerPath]: authApi.reducer,
    [omsApi.reducerPath]: omsApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(authApi.middleware, omsApi.middleware),
});

setupListeners(store.dispatch);
