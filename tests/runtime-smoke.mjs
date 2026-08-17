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
  navigator: { languages: ["ru-RU"], language: "ru-RU", clipboard: { writeText: async () => {} } },
  window: { matchMedia: () => ({ matches: false }), scrollTo() {}, addEventListener() {}, print() {} },
  requestAnimationFrame: (callback) => callback(),
  setTimeout: () => 1,
  clearTimeout() {},
  crypto: { randomUUID: (() => { let count = 0; return () => `test-${++count}`; })() },
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(`${read("i18n.js")}\n${read("i18n-v012.js")}\n${read("catalog.js")}\n${read("app.js")}\nthis.state = { repairs, currentCountry, currentCurrency, currentLanguage, t, extractResultPrice, parsePriceNumber, openDocument, normalizeRepair, recordRepairChanges };`, context);

assert.equal(context.state.currentLanguage, "ru");
assert.equal(context.state.currentCountry, "RU");
assert.equal(context.state.currentCurrency, "RUB");
assert.equal(elements.get("setupDialog").open, true, "Existing users should be asked to confirm a country");
assert.equal(elements.get("countryStep").hidden, false, "Country step should be open for an upgraded profile");

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

console.log("RepairDesk runtime checks passed: migration, price parsing, orders, history and documents.");
