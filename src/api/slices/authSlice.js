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

// The refresh token lives only in an httpOnly cookie (never in JS/localStorage)
// — see api/axiosBaseQuery.js for the silent-refresh-on-401 flow that uses it.
const authSlice = createSlice({
  name: "auth",
  initialState: {
    accessToken: stored?.accessToken ?? null,
    user: stored?.user ?? null,
  },
  reducers: {
    setCredentials: (state, action) => {
      const { access, user } = action.payload;
      state.accessToken = access;
      if (user) state.user = user;
    },
    setUser: (state, action) => {
      state.user = action.payload;
    },
    logout: (state) => {
      state.accessToken = null;
      state.user = null;
    },
  },
});

export const { setCredentials, setUser, logout } = authSlice.actions;
export const AUTH_STORAGE_KEY = STORAGE_KEY;
export default authSlice.reducer;
