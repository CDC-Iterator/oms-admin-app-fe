import { createSlice } from "@reduxjs/toolkit";

const STORAGE_KEY = "cdc_oms_auth";

function loadStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const stored = loadStoredAuth();

const authSlice = createSlice({
  name: "auth",
  initialState: {
    accessToken: stored?.accessToken ?? null,
    refreshToken: stored?.refreshToken ?? null,
    user: stored?.user ?? null,
  },
  reducers: {
    setCredentials: (state, action) => {
      const { access, refresh, user } = action.payload;
      state.accessToken = access;
      if (refresh) state.refreshToken = refresh;
      if (user) state.user = user;
    },
    setUser: (state, action) => {
      state.user = action.payload;
    },
    logout: (state) => {
      state.accessToken = null;
      state.refreshToken = null;
      state.user = null;
    },
  },
});

export const { setCredentials, setUser, logout } = authSlice.actions;
export const AUTH_STORAGE_KEY = STORAGE_KEY;
export default authSlice.reducer;
