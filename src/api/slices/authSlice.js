import { createSlice } from "@reduxjs/toolkit";

// Both the access token and the refresh token stay out of localStorage/
// sessionStorage — the access token lives only here (in memory, gone on
// reload) and the refresh token only in an httpOnly cookie neither JS nor
// this slice ever touches. See providers/AuthProvider.jsx for the boot-time
// silent refresh (cookie -> access token) this trades for "read it back
// from storage", and api/axiosBaseQuery.js for the same refresh reused
// reactively on a mid-session 401.
const authSlice = createSlice({
  name: "auth",
  initialState: {
    accessToken: null,
    user: null,
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
export default authSlice.reducer;
