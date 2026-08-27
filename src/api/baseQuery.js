/**
 * Picks the RTK Query base query for the OMS API slice: the real axios-backed
 * one (api/axiosBaseQuery.js) against Django, or the in-memory mock
 * (api/mock/mockBaseQuery.js) for a backend-less demo.
 *
 * Default is mock — the Phase 1 OMS screens (Orders, Inventory, Pending queue,
 * Mappings, Channels, Locations, Activity, Reports, Allocation) have no Django
 * models yet (see backend/). Flip VITE_USE_MOCK=false once those endpoints
 * exist; no screen or service code changes.
 */
import axiosBaseQuery from "./axiosBaseQuery.js";
import mockBaseQuery from "./mock/mockBaseQuery.js";

export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

export default USE_MOCK ? mockBaseQuery : axiosBaseQuery;
