/**
 * In-memory demo "database" for the CDC OMS front-end.
 *
 * This is the single source of truth while the app runs on mock data
 * (VITE_USE_MOCK). Every query reads from `db`; every mutation mutates it in
 * place and returns — RTK Query tag invalidation then triggers a refetch, so a
 * single "sell a unit" propagates live across every open screen. When the real
 * Django endpoints exist, flip VITE_USE_MOCK=false and this module drops out
 * entirely (see api/baseQuery.js).
 *
 * The one honest number the whole system defends: for any item code, the count
 * of serials still `available` — no channel is allowed to sell past it.
 */

// ---------------------------------------------------------------------------
// Small helpers (Date/Math are fine in the browser — only Workflow scripts ban
// them). ids are monotonic so ordering stays stable across a session.
// ---------------------------------------------------------------------------
let _seq = 1000;
const nextId = () => ++_seq;
const nowIso = () => new Date().toISOString();
const minutesAgo = (m) => new Date(Date.now() - m * 60_000).toISOString();

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------
const LOCATIONS = [
  { id: 1, code: "WH-MUM", name: "Mumbai Warehouse", type: "warehouse", zone: "Mumbai West" },
  { id: 2, code: "WH-DEL", name: "Delhi Warehouse", type: "warehouse", zone: "Delhi North" },
  { id: 3, code: "ST-DEL", name: "Delhi North Store", type: "store", zone: "Delhi North" },
  { id: 4, code: "ST-MUM", name: "Mumbai West Store", type: "store", zone: "Mumbai West" },
  { id: 5, code: "ST-HYD", name: "Hyderabad South Store", type: "store", zone: "Hyderabad South" },
];

// Priority-4 zone order from the allocation spec (Rishab, WhatsApp).
const ZONE_ORDER = ["Delhi North", "Mumbai West", "Hyderabad South"];

const CHANNELS = [
  {
    id: 1,
    key: "shopify",
    name: "Shopify",
    status: "connected",
    lastSyncAt: minutesAgo(1),
    filterRule: "All lines. Cumulative stock location carries the pushed availability.",
    storeDomain: "",
  },
];

// Item-code master. `channels` = where the line is meant to be listed.
const ITEMS = [
  { itemCode: "CL-1001", title: "Jordan 1 Retro Low OG SP Travis Scott Mocha", category: "Sneakers", homegrown: false, retailPrice: 165000 },
  { itemCode: "CL-1002", title: "Jordan 4 Retro Lakers", category: "Sneakers", homegrown: false, retailPrice: 42000 },
  { itemCode: "CL-1003", title: "New Balance 9060 Bodega Age of Discovery", category: "Sneakers", homegrown: false, retailPrice: 28000 },
  { itemCode: "CL-1004", title: "Salomon XT-6 Black Asphalt Castlerock", category: "Sneakers", homegrown: false, retailPrice: 21000 },
  { itemCode: "CL-1005", title: "Nike SB Dunk Low J-Pack Chicago", category: "Sneakers", homegrown: false, retailPrice: 89000 },
  { itemCode: "CL-1006", title: "Adidas Yeezy Boost 350 V2 Black Red", category: "Sneakers", homegrown: false, retailPrice: 38000 },
  { itemCode: "CL-1007", title: "On Running Cloudtilt Olive Desert", category: "Sneakers", homegrown: false, retailPrice: 16000 },
  { itemCode: "CL-1008", title: "New Balance 1906R Harbor Grey", category: "Sneakers", homegrown: false, retailPrice: 18500 },
  { itemCode: "CL-2001", title: "Deadbear Scribbled Bear Tee Black", category: "Apparel", homegrown: true, retailPrice: 2800 },
  { itemCode: "CL-2002", title: "CDC Distressed Black Tee 3.0", category: "Apparel", homegrown: true, retailPrice: 3200 },
  { itemCode: "CL-2003", title: "Gummy Bear Hoodie Cream White", category: "Apparel", homegrown: true, retailPrice: 5400 },
  { itemCode: "CL-2004", title: "Reverse Coco Cheesecake Socks", category: "Apparel", homegrown: true, retailPrice: 900 },
];

// Which channels each item is listed on. TataCliq is disabled for now — every
// item lists on Shopify only.
function channelsForItem() {
  return ["shopify"];
}

// Per-unit serials. Unit counts are intentionally small — most grails hold a
// single unit, which is exactly where a double-sale happens.
const UNIT_COUNTS = {
  "CL-1001": 1, // grail — single unit
  "CL-1002": 3,
  "CL-1003": 2,
  "CL-1004": 4,
  "CL-1005": 1, // grail — single unit
  "CL-1006": 2,
  "CL-1007": 5,
  "CL-1008": 3,
  "CL-2001": 8,
  "CL-2002": 6,
  "CL-2003": 4,
  "CL-2004": 10,
};

function buildSerials() {
  const serials = [];
  const locCodes = LOCATIONS.map((l) => l.code);
  ITEMS.forEach((item, ii) => {
    const count = UNIT_COUNTS[item.itemCode] ?? 1;
    for (let i = 0; i < count; i++) {
      const loc = locCodes[(ii + i) % locCodes.length];
      const ownership = (ii + i) % 3 === 0 ? "consignment" : "own";
      // Consignment units cost a little more to have sold; spread prices so the
      // allocation ranking has something to sort on.
      const base = Math.round(item.retailPrice * 0.55);
      const purchasePrice = base + i * Math.round(item.retailPrice * 0.04);
      serials.push({
        id: nextId(),
        itemCode: item.itemCode,
        barcode: `${item.itemCode}-${String(i + 1).padStart(2, "0")}`,
        ownership,
        purchasePrice,
        locationCode: loc,
        status: "available", // available | reserved | sold
        reservedForOrderId: null,
      });
    }
  });
  return serials;
}

// SKU / ID mappings: channel SKU ↔ POS item code.
function buildMappings() {
  const mappings = [];
  const prefix = { shopify: "SHOP" };
  ITEMS.forEach((item) => {
    channelsForItem(item).forEach((ch) => {
      mappings.push({
        id: nextId(),
        channel: ch,
        channelSku: `${prefix[ch]}-${item.itemCode.replace("CL-", "")}`,
        itemCode: item.itemCode,
      });
    });
  });
  return mappings;
}

function seedOrders(serials) {
  const orders = [];
  const reserve = (itemCode, channel, customerName, minsAgo) => {
    const serial = serials.find((s) => s.itemCode === itemCode && s.status === "available");
    const item = ITEMS.find((it) => it.itemCode === itemCode);
    const id = nextId();
    if (serial) {
      serial.status = "reserved";
      serial.reservedForOrderId = id;
    }
    orders.push({
      id,
      orderNumber: `${channel.slice(0, 3).toUpperCase()}-${id}`,
      channel,
      customerName,
      itemCode,
      title: item?.title ?? itemCode,
      serialId: serial?.id ?? null,
      barcode: serial?.barcode ?? null,
      qty: 1,
      unitPrice: item?.retailPrice ?? 0,
      currency: "INR",
      reservationStatus: "reserved",
      financialStatus: "paid",
      placedAt: minutesAgo(minsAgo),
      timeline: [
        { ts: minutesAgo(minsAgo), label: "Order received", channel },
        { ts: minutesAgo(minsAgo - 0.1), label: "Reserved against POS 2.0", channel: null },
      ],
    });
  };
  reserve("CL-1002", "shopify", "Aarav Mehta", 55);
  reserve("CL-1007", "shopify", "Neha Iyer", 40);
  reserve("CL-2001", "shopify", "Rohit Sharma", 22);
  reserve("CL-1004", "shopify", "Kabir Nair", 12);
  return orders;
}

function seedPending() {
  return [];
}

function seedActivity() {
  const mk = (mins, channel, kind, itemCode, message, status = "ok") => ({
    id: nextId(),
    ts: minutesAgo(mins),
    channel,
    kind,
    itemCode,
    message,
    status,
  });
  return [
    mk(1, "shopify", "availability_push", "CL-1004", "Pushed availability 4 → 3 after reservation"),
    mk(12, "shopify", "reservation", "CL-1004", "Reserved 1 unit against POS 2.0"),
    mk(22, "shopify", "reservation", "CL-2001", "Reserved 1 unit against POS 2.0"),
    mk(40, "shopify", "reservation", "CL-1007", "Reserved 1 unit against POS 2.0"),
    mk(55, "shopify", "reservation", "CL-1002", "Reserved 1 unit against POS 2.0"),
    mk(70, "shopify", "mismatch", "CL-1005", "Channel showed 1, pool held 0 — corrected to 0", "failed"),
  ];
}

const ALLOCATION_RULES = [
  { id: "ownership", label: "Ownership", detail: "Own inventory before consignment", enabled: true },
  { id: "price", label: "Purchase price", detail: "Lower purchase price before higher", enabled: true },
  { id: "storage", label: "Storage type", detail: "Warehouse before store", enabled: true },
  { id: "zone", label: "Zone", detail: "Delhi North → Mumbai West → Hyderabad South", enabled: true },
];

const USERS = [
  { id: 1, username: "asutosh", email: "asutosh@iterator.in", first_name: "Asutosh", last_name: "Mahapatra", role: "admin", locations: [], is_active: true },
  { id: 2, username: "fulfil.mumbai", email: "ops.mum@crepdogcrew.com", first_name: "Priya", last_name: "Kulkarni", role: "fulfilment", locations: ["ST-MUM", "WH-MUM"], is_active: true },
  { id: 3, username: "reports", email: "finance@crepdogcrew.com", first_name: "Devang", last_name: "Shah", role: "reporting", locations: [], is_active: true },
];

// ---------------------------------------------------------------------------
// The live database
// ---------------------------------------------------------------------------
export const db = {};

export function seed() {
  const serials = buildSerials();
  db.locations = LOCATIONS.map((l) => ({ ...l }));
  db.channels = CHANNELS.map((c) => ({ ...c }));
  db.items = ITEMS.map((it) => ({ ...it, channels: channelsForItem(it) }));
  db.serials = serials;
  db.mappings = buildMappings();
  db.orders = seedOrders(serials);
  db.pending = seedPending();
  db.activity = seedActivity();
  db.allocationRules = ALLOCATION_RULES.map((r) => ({ ...r }));
  db.users = USERS.map((u) => ({ ...u }));
}
seed();

// ---------------------------------------------------------------------------
// Derivations
// ---------------------------------------------------------------------------
export function locationByCode(code) {
  return db.locations.find((l) => l.code === code);
}

export function availableForItem(itemCode) {
  return db.serials.filter((s) => s.itemCode === itemCode && s.status === "available").length;
}

function breakdownForItem(itemCode) {
  const byLoc = {};
  db.serials
    .filter((s) => s.itemCode === itemCode && s.status === "available")
    .forEach((s) => {
      byLoc[s.locationCode] = (byLoc[s.locationCode] || 0) + 1;
    });
  return Object.entries(byLoc).map(([code, count]) => ({
    locationCode: code,
    locationName: locationByCode(code)?.name ?? code,
    count,
  }));
}

/** Rank an item's available serials by the current allocation rules order. */
export function rankSerials(itemCode) {
  const rules = db.allocationRules.filter((r) => r.enabled);
  const scored = db.serials.filter((s) => s.itemCode === itemCode && s.status === "available");
  const value = (serial, ruleId) => {
    const loc = locationByCode(serial.locationCode);
    switch (ruleId) {
      case "ownership":
        return serial.ownership === "own" ? 0 : 1;
      case "price":
        return serial.purchasePrice;
      case "storage":
        return loc?.type === "warehouse" ? 0 : 1;
      case "zone":
        return ZONE_ORDER.indexOf(loc?.zone ?? "");
      default:
        return 0;
    }
  };
  return [...scored].sort((a, b) => {
    for (const rule of rules) {
      const diff = value(a, rule.id) - value(b, rule.id);
      if (diff !== 0) return diff;
    }
    return a.id - b.id;
  });
}

// ---------------------------------------------------------------------------
// Query resolvers (shaped like DRF list/detail responses)
// ---------------------------------------------------------------------------
const page = (rows) => ({ count: rows.length, results: rows });

export function listOrders({ channel, status } = {}) {
  let rows = [...db.orders].sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
  if (channel) rows = rows.filter((o) => o.channel === channel);
  if (status) rows = rows.filter((o) => o.reservationStatus === status);
  return page(rows);
}

export function getOrder(id) {
  const order = db.orders.find((o) => o.id === Number(id));
  if (!order) return null;
  const serial = db.serials.find((s) => s.id === order.serialId);
  return { ...order, serial: serial ?? null };
}

export function listInventoryPool() {
  const rows = db.items.map((item) => ({
    id: item.itemCode, // DataTable keys rows by `id` — item code is the stable key here
    itemCode: item.itemCode,
    title: item.title,
    category: item.category,
    homegrown: item.homegrown,
    channels: item.channels,
    available: availableForItem(item.itemCode),
    total: db.serials.filter((s) => s.itemCode === item.itemCode).length,
    breakdown: breakdownForItem(item.itemCode),
  }));
  return page(rows);
}

export function listSerials(itemCode) {
  const rows = db.serials
    .filter((s) => s.itemCode === itemCode)
    .map((s) => ({ ...s, location: locationByCode(s.locationCode) }));
  return page(rows);
}

export function listMappings({ channel } = {}) {
  let rows = [...db.mappings];
  if (channel) rows = rows.filter((m) => m.channel === channel);
  return page(rows);
}

export function listPending() {
  return page([...db.pending]);
}

export function listChannels() {
  return page(
    db.channels.map((c) => ({
      ...c,
      mappedItems: db.mappings.filter((m) => m.channel === c.key).length,
    }))
  );
}

export function listLocations() {
  return page([...db.locations]);
}

export function listActivity({ kind } = {}) {
  let rows = [...db.activity].sort((a, b) => new Date(b.ts) - new Date(a.ts));
  if (kind) rows = rows.filter((a) => a.kind === kind);
  return page(rows);
}

export function listUsers() {
  return page([...db.users]);
}

export function getAllocationRules() {
  return { rules: [...db.allocationRules], zoneOrder: ZONE_ORDER };
}

export function getAllocationPreview(itemCode) {
  const ranked = rankSerials(itemCode).map((s, i) => ({
    ...s,
    location: locationByCode(s.locationCode),
    rank: i + 1,
    recommended: i === 0,
  }));
  const item = db.items.find((it) => it.itemCode === itemCode);
  return {
    itemCode,
    title: item?.title ?? itemCode,
    rules: db.allocationRules.filter((r) => r.enabled),
    serials: ranked,
  };
}

export function getReports() {
  const sold = db.orders.filter((o) => ["reserved", "restocked"].includes(o.reservationStatus));
  const channelSales = db.channels.map((c) => {
    const rows = sold.filter((o) => o.channel === c.key);
    return {
      id: c.key,
      channel: c.key,
      name: c.name,
      orders: rows.length,
      revenue: rows.reduce((sum, o) => sum + o.unitPrice * o.qty, 0),
    };
  });
  const statuses = {};
  db.orders.forEach((o) => {
    statuses[o.reservationStatus] = (statuses[o.reservationStatus] || 0) + 1;
  });
  const orderStatus = Object.entries(statuses).map(([status, count]) => ({ id: status, status, count }));
  const mismatch = db.activity.filter((a) => a.kind === "mismatch" || a.status !== "ok");
  return {
    channelSales,
    orderStatus,
    unmapped: [...db.pending],
    mismatch,
  };
}

export function getStats() {
  const lastSync = db.activity.reduce(
    (max, a) => (new Date(a.ts) > new Date(max) ? a.ts : max),
    db.activity[0]?.ts ?? nowIso()
  );
  const failures = db.activity.filter((a) => a.status !== "ok").length;
  const totalUnits = db.serials.filter((s) => s.status === "available").length;
  return {
    oversellExposure: 0,
    unmapped: db.pending.length,
    channelsInSync: db.channels.filter((c) => c.status === "connected").length,
    channelCount: db.channels.length,
    lastSyncAt: lastSync,
    syncFailures: failures,
    availableUnits: totalUnits,
    liveSkus: db.items.length,
    channelSales: getReports().channelSales,
    recentActivity: listActivity().results.slice(0, 6),
  };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
function logSync({ channel, kind, itemCode, message, status = "ok" }) {
  db.activity.unshift({ id: nextId(), ts: nowIso(), channel, kind, itemCode, message, status });
}

function pushAvailabilityToOthers(itemCode, exceptChannel, avail) {
  const item = db.items.find((it) => it.itemCode === itemCode);
  (item?.channels ?? []).forEach((ch) => {
    if (ch === exceptChannel) return;
    const c = db.channels.find((x) => x.key === ch);
    if (c) c.lastSyncAt = nowIso();
    logSync({
      channel: ch,
      kind: "availability_push",
      itemCode,
      message: `Pushed availability → ${avail}`,
    });
  });
}

/** The demo's beating heart: sell one unit on a channel and watch it move. */
export function sellUnit({ itemCode, channel }) {
  const item = db.items.find((it) => it.itemCode === itemCode);
  if (!item) return { ok: false, error: "Unknown item" };

  const mapping = db.mappings.find((m) => m.channel === channel && m.itemCode === itemCode);
  if (!mapping) {
    // No channel SKU mapped → the order can't resolve to a POS item code.
    const channelName = db.channels.find((c) => c.key === channel)?.name ?? channel;
    const prefix = { shopify: "SHOP" }[channel] ?? "CH";
    const pending = {
      id: nextId(),
      orderNumber: `${prefix}-PND-${nextId() % 1000}`,
      channel,
      channelSku: `${prefix}-${itemCode.replace("CL-", "")}-UNMAPPED`,
      suggestedItemCode: itemCode,
      title: item.title,
      customerName: "Demo Buyer",
      placedAt: nowIso(),
    };
    db.pending.unshift(pending);
    logSync({
      channel,
      kind: "order_fetch",
      itemCode,
      message: `Order on ${channelName} carries an unmapped SKU — held in queue`,
      status: "retry",
    });
    return { ok: true, pending: true, pendingId: pending.id };
  }

  const ranked = rankSerials(itemCode);
  if (ranked.length === 0) {
    logSync({
      channel,
      kind: "mismatch",
      itemCode,
      message: "Refused — 0 available. Live check against POS 2.0.",
      status: "failed",
    });
    return { ok: false, error: "No units available", refused: true };
  }

  const serial = ranked[0];
  const id = nextId();
  serial.status = "reserved";
  serial.reservedForOrderId = id;
  const order = {
    id,
    orderNumber: `${channel.slice(0, 3).toUpperCase()}-${id}`,
    channel,
    customerName: "Demo Buyer",
    itemCode,
    title: item.title,
    serialId: serial.id,
    barcode: serial.barcode,
    qty: 1,
    unitPrice: item.retailPrice,
    currency: "INR",
    reservationStatus: "reserved",
    financialStatus: "paid",
    placedAt: nowIso(),
    timeline: [
      { ts: nowIso(), label: `Order received on ${channel}`, channel },
      { ts: nowIso(), label: `Reserved serial ${serial.barcode} against POS 2.0`, channel: null },
    ],
  };
  db.orders.unshift(order);
  logSync({ channel, kind: "reservation", itemCode, message: `Reserved ${serial.barcode} against POS 2.0` });
  pushAvailabilityToOthers(itemCode, channel, availableForItem(itemCode));
  return { ok: true, orderId: id, barcode: serial.barcode };
}

export function reverseOrder({ id, mode }) {
  const order = db.orders.find((o) => o.id === Number(id));
  if (!order) return { ok: false, error: "Order not found" };
  const serial = db.serials.find((s) => s.id === order.serialId);
  if (serial) {
    serial.status = "available";
    serial.reservedForOrderId = null;
  }
  const label = { cancel: "Cancelled", return: "Returned", rto: "RTO — returned to origin" }[mode] || "Reversed";
  order.reservationStatus = mode === "cancel" ? "cancelled" : "restocked";
  order.timeline = [
    ...(order.timeline || []),
    { ts: nowIso(), label: `${label} — unit restocked into the pool`, channel: null },
  ];
  logSync({
    channel: order.channel,
    kind: "restock",
    itemCode: order.itemCode,
    message: `${label}: ${order.barcode || "unit"} rejoined the pool`,
  });
  pushAvailabilityToOthers(order.itemCode, null, availableForItem(order.itemCode));
  return { ok: true };
}

export function mapPending({ id, itemCode }) {
  const idx = db.pending.findIndex((p) => p.id === Number(id));
  if (idx === -1) return { ok: false, error: "Pending order not found" };
  const pending = db.pending[idx];
  const item = db.items.find((it) => it.itemCode === itemCode);
  // Persist the mapping so future orders on this SKU resolve automatically.
  db.mappings.push({ id: nextId(), channel: pending.channel, channelSku: pending.channelSku, itemCode });
  db.pending.splice(idx, 1);
  logSync({
    channel: pending.channel,
    kind: "mapping",
    itemCode,
    message: `Mapped ${pending.channelSku} → ${itemCode}`,
  });

  const ranked = rankSerials(itemCode);
  const serial = ranked[0];
  const orderId = nextId();
  if (serial) {
    serial.status = "reserved";
    serial.reservedForOrderId = orderId;
  }
  db.orders.unshift({
    id: orderId,
    orderNumber: pending.orderNumber.replace("PND", "ORD"),
    channel: pending.channel,
    customerName: pending.customerName,
    itemCode,
    title: item?.title ?? itemCode,
    serialId: serial?.id ?? null,
    barcode: serial?.barcode ?? null,
    qty: 1,
    unitPrice: item?.retailPrice ?? 0,
    currency: "INR",
    reservationStatus: "reserved",
    financialStatus: "paid",
    placedAt: nowIso(),
    timeline: [
      { ts: pending.placedAt, label: `Order received on ${pending.channel}`, channel: pending.channel },
      { ts: nowIso(), label: `SKU mapped, rejoined the flow — reserved against POS 2.0`, channel: null },
    ],
  });
  logSync({ channel: pending.channel, kind: "reservation", itemCode, message: `Reserved against POS 2.0 after mapping` });
  if (serial) pushAvailabilityToOthers(itemCode, pending.channel, availableForItem(itemCode));
  return { ok: true, orderId };
}

export function saveAllocationRules(rules) {
  db.allocationRules = rules.map((r) => ({ ...r }));
  return { ok: true, rules: db.allocationRules };
}

// Mapping CRUD
export function createMapping(body) {
  const mapping = { id: nextId(), ...body };
  db.mappings.push(mapping);
  logSync({ channel: body.channel, kind: "mapping", itemCode: body.itemCode, message: `Mapped ${body.channelSku} → ${body.itemCode}` });
  return mapping;
}
export function updateMapping(id, body) {
  const m = db.mappings.find((x) => x.id === Number(id));
  if (m) Object.assign(m, body);
  return m;
}
export function deleteMapping(id) {
  db.mappings = db.mappings.filter((x) => x.id !== Number(id));
  return {};
}

// User CRUD
export function createUser(body) {
  const user = { id: nextId(), locations: [], is_active: true, ...body };
  db.users.push(user);
  return user;
}
export function updateUser(id, body) {
  const u = db.users.find((x) => x.id === Number(id));
  if (u) Object.assign(u, body);
  return u;
}
export function deleteUser(id) {
  db.users = db.users.filter((x) => x.id !== Number(id));
  return {};
}

// Channels / Locations light mutations
export function updateChannel(id, body) {
  const c = db.channels.find((x) => x.id === Number(id));
  if (c) Object.assign(c, body);
  return c;
}
export function disconnectChannel(id) {
  const c = db.channels.find((x) => x.id === Number(id));
  if (c) Object.assign(c, { storeDomain: "", status: "disconnected", lastSyncAt: null });
  return c;
}
export function createLocation(body) {
  const loc = { id: nextId(), ...body };
  db.locations.push(loc);
  return loc;
}
export function updateLocation(id, body) {
  const l = db.locations.find((x) => x.id === Number(id));
  if (l) Object.assign(l, body);
  return l;
}
export function deleteLocation(id) {
  db.locations = db.locations.filter((x) => x.id !== Number(id));
  return {};
}

// Auth
export function login({ username }) {
  const user =
    db.users.find((u) => u.username.toLowerCase() === (username || "").toLowerCase()) || db.users[0];
  return {
    access: `mock-access-${user.id}-${Date.now()}`,
    refresh: `mock-refresh-${user.id}`,
    user,
  };
}
export function getMe(token) {
  if (!token) return null;
  const match = /mock-access-(\d+)-/.exec(token);
  const id = match ? Number(match[1]) : db.users[0].id;
  return db.users.find((u) => u.id === id) || db.users[0];
}
