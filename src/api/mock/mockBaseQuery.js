/**
 * A mock RTK Query base query that stands in for the real Django backend while
 * VITE_USE_MOCK is on. It routes each request's { url, method } to a handler
 * over the in-memory mockDb (see mockDb.js), returning DRF-shaped payloads.
 *
 * Because every endpoint in oms.js still declares a real url + method, the only
 * thing that changes when the backend is ready is api/baseQuery.js flipping to
 * axiosBaseQuery — no screen or service edits.
 */
import * as m from "./mockDb.js";

// Small artificial latency so loading skeletons actually show, like a network.
const LATENCY_MS = 220;
const delay = () => new Promise((r) => setTimeout(r, LATENCY_MS));

// [method, RegExp, handler(ctx)] — first match wins. `ctx` = { match, params,
// body, token }. `match` holds the regex capture groups (ids/itemCodes).
const ROUTES = [
  // --- Auth ---
  ["POST", /^\/api\/auth\/login\/$/, ({ body }) => m.login(body)],
  ["GET", /^\/api\/auth\/me\/$/, ({ token }) => m.getMe(token)],
  ["POST", /^\/api\/auth\/logout\/$/, () => ({})],
  ["POST", /^\/api\/auth\/refresh\/$/, ({ token }) => ({ access: token || "mock-access" })],

  // --- Users ---
  ["GET", /^\/api\/users\/$/, () => m.listUsers()],
  ["POST", /^\/api\/users\/$/, ({ body }) => m.createUser(body)],
  ["PATCH", /^\/api\/users\/(\d+)\/$/, ({ match, body }) => m.updateUser(match[1], body)],
  ["DELETE", /^\/api\/users\/(\d+)\/$/, ({ match }) => m.deleteUser(match[1])],

  // --- Orders ---
  ["GET", /^\/api\/orders\/$/, ({ params }) => m.listOrders(params)],
  ["GET", /^\/api\/orders\/(\d+)\/$/, ({ match }) => m.getOrder(match[1])],
  ["POST", /^\/api\/orders\/(\d+)\/reverse\/$/, ({ match, body }) => m.reverseOrder({ id: match[1], mode: body?.mode })],

  // --- Inventory pool ---
  ["GET", /^\/api\/inventory\/pool\/$/, () => m.listInventoryPool()],
  ["GET", /^\/api\/inventory\/([\w-]+)\/serials\/$/, ({ match }) => m.listSerials(match[1])],

  // --- Mappings ---
  ["GET", /^\/api\/mappings\/$/, ({ params }) => m.listMappings(params)],
  ["POST", /^\/api\/mappings\/$/, ({ body }) => m.createMapping(body)],
  ["PATCH", /^\/api\/mappings\/(\d+)\/$/, ({ match, body }) => m.updateMapping(match[1], body)],
  ["DELETE", /^\/api\/mappings\/(\d+)\/$/, ({ match }) => m.deleteMapping(match[1])],

  // --- Pending queue ---
  ["GET", /^\/api\/pending\/$/, () => m.listPending()],
  ["POST", /^\/api\/pending\/(\d+)\/map\/$/, ({ match, body }) => m.mapPending({ id: match[1], itemCode: body?.itemCode })],

  // --- Channels ---
  ["GET", /^\/api\/channels\/$/, () => m.listChannels()],
  ["PATCH", /^\/api\/channels\/(\d+)\/$/, ({ match, body }) => m.updateChannel(match[1], body)],
  ["POST", /^\/api\/channels\/(\d+)\/disconnect\/$/, ({ match }) => m.disconnectChannel(match[1])],

  // --- Locations ---
  ["GET", /^\/api\/locations\/$/, () => m.listLocations()],
  ["POST", /^\/api\/locations\/$/, ({ body }) => m.createLocation(body)],
  ["PATCH", /^\/api\/locations\/(\d+)\/$/, ({ match, body }) => m.updateLocation(match[1], body)],
  ["DELETE", /^\/api\/locations\/(\d+)\/$/, ({ match }) => m.deleteLocation(match[1])],

  // --- Activity / Reports / Stats ---
  ["GET", /^\/api\/activity\/$/, ({ params }) => m.listActivity(params)],
  ["GET", /^\/api\/reports\/$/, () => m.getReports()],
  ["GET", /^\/api\/stats\/$/, () => m.getStats()],

  // --- Allocation (PROPOSED — extra scope) ---
  ["GET", /^\/api\/allocation\/rules\/$/, () => m.getAllocationRules()],
  ["PUT", /^\/api\/allocation\/rules\/$/, ({ body }) => m.saveAllocationRules(body?.rules ?? [])],
  ["GET", /^\/api\/allocation\/preview\/([\w-]+)\/$/, ({ match }) => m.getAllocationPreview(match[1])],

  // --- Demo simulator ---
  ["POST", /^\/api\/demo\/sell\/$/, ({ body }) => m.sellUnit(body)],

  // --- Untouched Shopify mirrors (out of Phase 1 OMS scope) — empty under
  // mock so these screens show their real empty state instead of erroring. ---
  ["GET", /^\/api\/fulfillments\/$/, () => ({ count: 0, results: [] })],
  ["GET", /^\/api\/customers\/$/, () => ({ count: 0, results: [] })],
];

const mockBaseQuery = async ({ url, method = "GET", body, params }, api) => {
  await delay();
  const token = api?.getState?.()?.auth?.accessToken;
  const upper = method.toUpperCase();
  // Strip any trailing query string; params come through the params arg.
  const path = url.split("?")[0];

  for (const [routeMethod, pattern, handler] of ROUTES) {
    if (routeMethod !== upper) continue;
    const match = pattern.exec(path);
    if (!match) continue;
    try {
      const data = handler({ match, params, body, token });
      if (data == null) {
        return { error: { status: 404, data: { message: "Not found" } } };
      }
      // Domain failures (e.g. sell refused — 0 available) surface as errors so
      // callers can toast via formatApiError.
      if (data.ok === false) {
        return { error: { status: 409, data: { message: data.error || "Operation failed" } } };
      }
      return { data };
    } catch (err) {
      return { error: { status: 500, data: { message: err?.message || "Mock handler error" } } };
    }
  }
  return { error: { status: 404, data: { message: `No mock route for ${upper} ${path}` } } };
};

export default mockBaseQuery;
