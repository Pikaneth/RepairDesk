import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), "utf8");
const html = read("index.html");

class ClassList {
  constructor() { this.values = new Set(); }
  add(...values) { values.forEach((value) => this.values.add(value)); }
  remove(...values) { values.forEach((value) => this.values.delete(value)); }
  toggle(value, force) {
    const enabled = force === undefined ? !this.values.has(value) : Boolean(force);
    if (enabled) this.values.add(value); else this.values.delete(value);
    return enabled;
  }
  contains(value) { return this.values.has(value); }
}

class Element {
  constructor(id = "") {
    this.id = id;
    this.value = "";
    this.textContent = "";
    this.innerHTML = "";
    this.hidden = false;
    this.open = false;
    this.disabled = false;
    this.dataset = {};
    this.classList = new ClassList();
    this.children = [];
    this.attributes = new Map();
  }
  addEventListener() {}
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = [...children]; this.innerHTML = ""; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) || null; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  focus() {}
  closest() { return null; }
  cloneNode() { return new Element(this.id); }
  getBoundingClientRect() { return { left: 0, right: 100, top: 0, bottom: 100 }; }
}

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const elements = new Map(ids.map((id) => [id, new Element(id)]));
elements.get("statusFilter").value = "all";
elements.get("sortSelect").value = "newest";
elements.get("currencySelect").value = "RUB";

const documentElement = new Element("html");
documentElement.dataset = {};
const body = new Element("body");
const head = new Element("head");
const metaDescription = { content: "" };
const metaTheme = { content: "" };
const setupProgress = [new Element(), new Element(), new Element()];

const document = {
  documentElement,
  body,
  head,
  title: "",
  getElementById: (id) => elements.get(id) || null,
  querySelector: (selector) => selector.includes('meta[name="description"]') ? metaDescription : selector.includes('meta[name="theme-color"]') ? metaTheme : null,
  querySelectorAll: (selector) => selector === ".setup-progress span" ? setupProgress : [],
  createElement: () => new Element(),
  createTextNode: (value) => ({ textContent: String(value) }),
  createRange: () => ({ selectNodeContents() {}, createContextualFragment: () => new Element() }),
  addEventListener() {},
};

const store = new Map();
store.set("repairdesk.settings.v1", JSON.stringify({ language: "ru", currency: "RUB", setupComplete: true }));
store.set("repairdesk.repairs.v1", JSON.stringify([{
  id: "legacy-repair",
  device: "Samsung Galaxy S23",
  category: "smartphone",
  issue: "Разбит дисплей",
  status: "completed",
  received: "2026-08-10",
  target: "2026-08-12",
  labour: 40,
  parts: [{ id: "display", name: "OLED дисплей", cost: 120 }],
  notes: "Проверено",
  createdAt: "2026-08-10T10:00:00.000Z",
  updatedAt: "2026-08-12T12:00:00.000Z",
}]));

const context = {
  console,
  Intl,
  URL,
  URLSearchParams,
  Date,
  Math,
  JSON,
  Number,
  String,
  Object,
  Array,
  Set,
  Map,
  RegExp,
  document,
  localStorage: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)) },
  navigator: { languages: ["ru-RU"], language: "ru-RU", onLine: true, clipboard: { writeText: async () => {} } },
  window: { location: { origin: "http://localhost:8000", pathname: "/", search: "" }, matchMedia: () => ({ matches: false }), scrollTo() {}, addEventListener() {}, print() {} },
  requestAnimationFrame: (callback) => callback(),
  setTimeout: () => 1,
  clearTimeout() {},
  crypto: { randomUUID: (() => { let count = 0; return () => `test-${++count}`; })() },
};
context.RepairDeskCloud = {
  init: async () => ({ configured: false, session: null, user: null }),
  signUp: async () => { throw new Error("Not configured"); },
  signIn: async () => { throw new Error("Not configured"); },
  signOut: async () => {},
  sendPasswordReset: async () => {},
  updatePassword: async () => {},
  loadSnapshot: async () => null,
  saveSnapshot: async () => ({ ok: false, offline: true }),
  updateProfile: async () => {},
  submitFeedback: async () => {},
  loadAdminDashboard: async () => ({ totals: {}, daily: [], feedback: [] }),
  loadAdminUsers: async () => ({ total: 0, users: [] }),
  updateFeedbackStatus: async () => {},
  track: async () => {},
};
context.window.RepairDeskCloud = context.RepairDeskCloud;
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(`${read("i18n.js")}\n${read("i18n-v012.js")}\n${read("i18n-v020.js")}\n${read("catalog.js")}\n${read("app.js")}\nthis.state = { repairs, currentCountry, currentCurrency, currentLanguage, t, extractResultPrice, parsePriceNumber, openDocument, normalizeRepair, recordRepairChanges, mergeDeletedLists, mergeRepairLists, chooseNewestSettings, continueLocally, adminCsvCell, adminViewRequested, setAdminTestData(value, users) { cloudProfile = { is_admin: true }; adminDashboard = value; adminUsers = users; renderAdminData(); } };`, context);
await new Promise((resolve) => setImmediate(resolve));

assert.equal(context.state.currentLanguage, "ru");
assert.equal(context.state.currentCountry, "RU");
assert.equal(context.state.currentCurrency, "RUB");
assert.equal(context.state.adminViewRequested(), false);
context.window.location.search = "?admin=1";
assert.equal(context.state.adminViewRequested(), true, "The owner console must support a direct sign-in route");
context.window.location.search = "";
assert.equal(elements.get("setupDialog").open, true, "Existing users should be asked to confirm a country");
assert.equal(elements.get("countryStep").hidden, false, "Country step should be open for an upgraded profile");

context.state.continueLocally();
assert.equal(store.get("repairdesk.cloud.local-mode.v1"), "1", "An explicit local-mode choice must survive a reload");

const repair = context.state.repairs[0];
assert.equal(repair.history[0].type, "created");
assert.ok(repair.history.some((event) => event.type === "status"));
assert.equal(JSON.stringify(repair.customer), JSON.stringify({ name: "", phone: "", email: "", address: "" }));

assert.equal(context.state.parsePriceNumber("1 299,95 €"), 1299.95);
const resultPrice = context.state.extractResultPrice({
  titleNoFormatting: "OLED display",
  richSnippet: { product: [{ offers: [{ price: "89.90", pricecurrency: "EUR" }] }] },
});
assert.equal(resultPrice.price, 89.9);
assert.equal(resultPrice.currency, "EUR");

vm.runInContext(`
  const beforeOrder = repairs[0];
  const afterOrder = normalizeRepair({
    ...beforeOrder,
    status: "waiting",
    updatedAt: "2026-08-13T09:00:00.000Z",
    parts: beforeOrder.parts.map((part) => ({
      ...part,
      order: { status: "waiting", vendor: "Parts Store", title: part.name, url: "https://example.com/part", price: 120, currency: "RUB", orderedAt: "2026-08-13T09:00:00.000Z" },
    })),
  });
  recordRepairChanges(beforeOrder, afterOrder);
  this.orderState = afterOrder;
`, context);
assert.ok(context.orderState.history.some((event) => event.type === "part-ordered"));
assert.ok(context.orderState.history.some((event) => event.type === "status" && event.data.to === "waiting"));

vm.runInContext("openDocument('legacy-repair', 'invoice'); this.documentState = repairs[0];", context);
assert.match(context.documentState.documents.invoice.number, /^RD-INV-2026-0001$/);
assert.ok(context.documentState.history.some((event) => event.type === "document"));
assert.equal(elements.get("documentDialog").open, true);
assert.match(elements.get("documentSheet").innerHTML, /Samsung Galaxy S23/);

const localRepair = context.state.normalizeRepair({ id: "shared", device: "Local version", updatedAt: "2026-08-18T10:00:00.000Z" });
const remoteRepair = context.state.normalizeRepair({ id: "shared", device: "Remote version", updatedAt: "2026-08-18T09:00:00.000Z" });
const remoteOnly = context.state.normalizeRepair({ id: "remote-only", device: "Remote only", updatedAt: "2026-08-18T11:00:00.000Z" });
const tombstones = context.state.mergeDeletedLists(
  [{ id: "remote-only", deletedAt: "2026-08-18T12:00:00.000Z" }],
  [{ id: "old-delete", deletedAt: "2026-08-17T12:00:00.000Z" }],
);
const mergedRepairs = context.state.mergeRepairLists([localRepair], [remoteRepair, remoteOnly], tombstones);
assert.equal(mergedRepairs.length, 1, "A newer tombstone must suppress an older repair copy");
assert.equal(mergedRepairs[0].device, "Local version", "The latest repair update must win a sync conflict");

const newestSettings = context.state.chooseNewestSettings(
  { language: "ru", country: "RU", currency: "RUB", workspace: { inventory: [{ id: "oled", name: "OLED" }] }, updatedAt: "2026-08-18T12:00:00.000Z" },
  { language: "en", country: "US", currency: "USD", updatedAt: "2026-08-18T11:00:00.000Z" },
);
assert.equal(newestSettings.language, "ru", "The newest workshop settings must win a sync conflict");
assert.equal(newestSettings.workspace.inventory[0].name, "OLED", "Advanced workspace data must survive cloud conflict resolution");

context.state.setAdminTestData({
  totals: { total_users: 12, new_users_30d: 5, active_today: 3, active_7d: 8, returning_30d: 4, open_feedback: 1, events_30d: 37, cloud_workspaces: 9, active_workspaces_24h: 3, stale_workspaces_30d: 2, total_repairs: 48, storage_bytes: 15360 },
  daily: [{ day: new Date().toISOString().slice(0, 10), active_users: 3, events: 9 }],
  event_breakdown: [{ name: "repair_created", count: 14 }, { name: "app_open", count: 9 }],
  country_breakdown: [{ country: "DE", count: 7 }],
  feedback: [{ id: 1, type: "idea", message: "Добавить сканер штрихкодов", page: "settings", app_version: "0.3.4", status: "new", created_at: "2026-08-18T10:00:00.000Z", workshop_name: "Тестовая мастерская", user_email: "owner@example.com" }],
  audit: [{ id: 1, action: "feedback_status_changed", target_id: "1", details: { from: "new", to: "planned" }, created_at: "2026-08-18T11:00:00.000Z", admin_email: "owner@example.com" }],
}, {
  total: 1,
  users: [{ id: "owner", email: "owner@example.com", email_confirmed_at: "2026-08-18T09:00:00.000Z", created_at: "2026-08-18T09:00:00.000Z", last_seen_at: "2026-08-18T11:00:00.000Z", last_sync_at: "2026-08-18T11:00:00.000Z", workshop_name: "Тестовая мастерская", country: "DE", language: "ru", currency: "EUR", revision: 5, repair_count: 4, snapshot_bytes: 2048 }],
});
assert.equal(elements.get("adminTotalUsers").textContent, "12");
assert.equal(elements.get("adminReturningUsers").textContent, "4");
assert.equal(elements.get("adminCloudWorkspaces").textContent, "9");
assert.equal(elements.get("adminTotalRepairs").textContent, "48");
assert.equal(elements.get("adminDailyChart").children.length, 30, "The owner chart must cover 30 calendar days");
assert.equal(elements.get("adminEventBreakdown").children.length, 2, "The owner console must render event breakdowns");
assert.equal(elements.get("adminCountryBreakdown").children.length, 1, "The owner console must render country breakdowns");
assert.equal(elements.get("adminUsersTableBody").children.length, 1, "The user directory must render account health rows");
assert.equal(elements.get("adminFeedbackInbox").children.length, 1, "Feedback must appear in the owner inbox");
assert.match(elements.get("adminFeedbackInbox").children[0].innerHTML, /сканер штрихкодов/);
assert.equal(elements.get("adminAuditLog").children.length, 1, "Audited owner actions must be visible");
assert.match(context.state.adminCsvCell("=HYPERLINK(\"https://example.com\")"), /^"'/, "CSV exports must neutralise spreadsheet formulas");

console.log("RepairDesk runtime checks passed: migration, sync merge, owner console, safe export, price parsing, orders, history and documents.");
