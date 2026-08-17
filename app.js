const STORAGE_KEY = "repairdesk.repairs.v1";
const SETTINGS_KEY = "repairdesk.settings.v1";
const THEME_KEY = "repairdesk.theme";

const { languages, messages } = RepairDeskI18n;
const languageByCode = new Map(languages.map((language) => [language.code, language]));
const validStatuses = new Set(["waiting", "in-progress", "completed"]);
const validCategories = new Set(["smartphone", "tablet", "laptop", "desktop", "console", "other"]);
const categoryAliases = {
  Smartphone: "smartphone",
  Tablet: "tablet",
  Laptop: "laptop",
  "Desktop PC": "desktop",
  "Game console": "console",
  Other: "other",
};

const fallbackCurrencies = (
  "AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BOV BRL BSD BTN BWP BYN BZD " +
  "CAD CDF CHE CHF CHW CLF CLP CNY COP COU CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL " +
  "GHS GIP GMD GNF GTQ GYD HKD HNL HRK HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW " +
  "KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MXV MYR MZN " +
  "NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP " +
  "SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD USN UYI UYU UYW UZS " +
  "VED VES VND VUV WST XAF XAG XAU XBA XBB XBC XBD XCD XCG XDR XOF XPD XPF XPT XSU XUA YER ZAR ZMW ZWG"
).split(" ");

const regionCurrencies = {
  AE: "AED", AF: "AFN", AL: "ALL", AM: "AMD", AO: "AOA", AR: "ARS", AT: "EUR", AU: "AUD", AZ: "AZN",
  BA: "BAM", BB: "BBD", BD: "BDT", BE: "EUR", BG: "BGN", BH: "BHD", BI: "BIF", BM: "BMD", BN: "BND",
  BO: "BOB", BR: "BRL", BS: "BSD", BW: "BWP", BY: "BYN", BZ: "BZD", CA: "CAD", CD: "CDF", CH: "CHF",
  CL: "CLP", CN: "CNY", CO: "COP", CR: "CRC", CU: "CUP", CV: "CVE", CY: "EUR", CZ: "CZK", DE: "EUR",
  DJ: "DJF", DK: "DKK", DO: "DOP", DZ: "DZD", EC: "USD", EE: "EUR", EG: "EGP", ER: "ERN", ES: "EUR",
  ET: "ETB", FI: "EUR", FJ: "FJD", FR: "EUR", GB: "GBP", GE: "GEL", GH: "GHS", GI: "GIP", GM: "GMD",
  GN: "GNF", GR: "EUR", GT: "GTQ", GY: "GYD", HK: "HKD", HN: "HNL", HR: "EUR", HT: "HTG", HU: "HUF",
  ID: "IDR", IE: "EUR", IL: "ILS", IN: "INR", IQ: "IQD", IR: "IRR", IS: "ISK", IT: "EUR", JM: "JMD",
  JO: "JOD", JP: "JPY", KE: "KES", KG: "KGS", KH: "KHR", KM: "KMF", KP: "KPW", KR: "KRW", KW: "KWD",
  KZ: "KZT", LA: "LAK", LB: "LBP", LK: "LKR", LR: "LRD", LY: "LYD", MA: "MAD", MD: "MDL", ME: "EUR",
  MG: "MGA", MK: "MKD", MM: "MMK", MN: "MNT", MO: "MOP", MR: "MRU", MT: "EUR", MU: "MUR", MV: "MVR",
  MW: "MWK", MX: "MXN", MY: "MYR", MZ: "MZN", NA: "NAD", NG: "NGN", NI: "NIO", NL: "EUR", NO: "NOK",
  NP: "NPR", NZ: "NZD", OM: "OMR", PA: "PAB", PE: "PEN", PG: "PGK", PH: "PHP", PK: "PKR", PL: "PLN",
  PT: "EUR", PY: "PYG", QA: "QAR", RO: "RON", RS: "RSD", RU: "RUB", RW: "RWF", SA: "SAR", SB: "SBD",
  SC: "SCR", SD: "SDG", SE: "SEK", SG: "SGD", SI: "EUR", SK: "EUR", SO: "SOS", SR: "SRD", SS: "SSP",
  TH: "THB", TJ: "TJS", TM: "TMT", TN: "TND", TO: "TOP", TR: "TRY", TT: "TTD", TW: "TWD", TZ: "TZS",
  UA: "UAH", UG: "UGX", US: "USD", UY: "UYU", UZ: "UZS", VE: "VES", VN: "VND", VU: "VUV", WS: "WST",
  YE: "YER", ZA: "ZAR", ZM: "ZMW", ZW: "ZWG",
};

const languageCurrencies = {
  en: "USD", ru: "RUB", uk: "UAH", de: "EUR", ja: "JPY", fr: "EUR", it: "EUR", es: "EUR", pt: "EUR",
  zh: "CNY", hi: "INR", ar: "SAR", bn: "BDT", tr: "TRY", ko: "KRW", id: "IDR", pl: "PLN", nl: "EUR",
  vi: "VND", th: "THB",
};

const elements = {
  activeCount: document.querySelector("#activeCount"),
  activeHint: document.querySelector("#activeHint"),
  waitingCount: document.querySelector("#waitingCount"),
  completedCount: document.querySelector("#completedCount"),
  completedHint: document.querySelector("#completedHint"),
  totalSpent: document.querySelector("#totalSpent"),
  currencyStatSymbol: document.querySelector("#currencyStatSymbol"),
  resultCount: document.querySelector("#resultCount"),
  repairGrid: document.querySelector("#repairGrid"),
  emptyState: document.querySelector("#emptyState"),
  emptyTitle: document.querySelector("#emptyTitle"),
  emptyCopy: document.querySelector("#emptyCopy"),
  searchInput: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  themeToggle: document.querySelector("#themeToggle"),
  mobileThemeToggle: document.querySelector("#mobileThemeToggle"),
  themeLabel: document.querySelector("#themeLabel"),
  preferencesButton: document.querySelector("#preferencesButton"),
  mobilePreferencesButton: document.querySelector("#mobilePreferencesButton"),
  preferencesLabel: document.querySelector("#preferencesLabel"),
  addRepairButton: document.querySelector("#addRepairButton"),
  emptyAddButton: document.querySelector("#emptyAddButton"),
  repairDialog: document.querySelector("#repairDialog"),
  repairForm: document.querySelector("#repairForm"),
  repairId: document.querySelector("#repairId"),
  dialogTitle: document.querySelector("#dialogTitle"),
  submitButtonLabel: document.querySelector("#submitButtonLabel"),
  closeDialogButton: document.querySelector("#closeDialogButton"),
  cancelButton: document.querySelector("#cancelButton"),
  deviceInput: document.querySelector("#deviceInput"),
  categoryInput: document.querySelector("#categoryInput"),
  statusInput: document.querySelector("#statusInput"),
  issueInput: document.querySelector("#issueInput"),
  serialInput: document.querySelector("#serialInput"),
  receivedInput: document.querySelector("#receivedInput"),
  targetInput: document.querySelector("#targetInput"),
  labourInput: document.querySelector("#labourInput"),
  notesInput: document.querySelector("#notesInput"),
  deviceError: document.querySelector("#deviceError"),
  issueError: document.querySelector("#issueError"),
  addPartButton: document.querySelector("#addPartButton"),
  partsList: document.querySelector("#partsList"),
  partRowTemplate: document.querySelector("#partRowTemplate"),
  formTotal: document.querySelector("#formTotal"),
  confirmDialog: document.querySelector("#confirmDialog"),
  cancelDeleteButton: document.querySelector("#cancelDeleteButton"),
  confirmDeleteButton: document.querySelector("#confirmDeleteButton"),
  toast: document.querySelector("#toast"),
  setupDialog: document.querySelector("#setupDialog"),
  setupCloseButton: document.querySelector("#setupCloseButton"),
  languageStep: document.querySelector("#languageStep"),
  currencyStep: document.querySelector("#currencyStep"),
  languageGrid: document.querySelector("#languageGrid"),
  languageContinueButton: document.querySelector("#languageContinueButton"),
  currencySelect: document.querySelector("#currencySelect"),
  currencyPreview: document.querySelector("#currencyPreview"),
  currencyBackButton: document.querySelector("#currencyBackButton"),
  finishSetupButton: document.querySelector("#finishSetupButton"),
  setupProgress: document.querySelectorAll(".setup-progress span"),
};

function readStorage(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

function detectLanguage() {
  const browserLanguages = navigator.languages?.length ? navigator.languages : [navigator.language || "en"];
  for (const locale of browserLanguages) {
    const code = String(locale).toLowerCase().split("-")[0];
    if (languageByCode.has(code)) return code;
  }
  return "en";
}

function browserRegion() {
  const locale = navigator.languages?.[0] || navigator.language || "";
  try { return new Intl.Locale(locale).region || ""; }
  catch {
    const match = String(locale).match(/[-_]([A-Za-z]{2})\b/);
    return match ? match[1].toUpperCase() : "";
  }
}

function supportedCurrencies() {
  try {
    if (typeof Intl.supportedValuesOf === "function") return Intl.supportedValuesOf("currency");
  } catch {
    // Older browsers use the maintained ISO 4217 fallback list.
  }
  return fallbackCurrencies;
}

const currencies = [...new Set(supportedCurrencies())].sort();

function detectCurrency(language) {
  return regionCurrencies[browserRegion()] || languageCurrencies[language] || "USD";
}

function loadSettings() {
  const detectedLanguage = detectLanguage();
  const fallback = { language: detectedLanguage, currency: detectCurrency(detectedLanguage), setupComplete: false };
  const stored = readStorage(SETTINGS_KEY);
  if (!stored) return fallback;
  try {
    const parsed = JSON.parse(stored);
    const language = languageByCode.has(parsed.language) ? parsed.language : fallback.language;
    const currency = currencies.includes(parsed.currency) ? parsed.currency : detectCurrency(language);
    return { language, currency, setupComplete: Boolean(parsed.setupComplete) };
  } catch { return fallback; }
}

const initialSettings = loadSettings();
let currentLanguage = initialSettings.language;
let currentCurrency = initialSettings.currency;
let setupComplete = initialSettings.setupComplete;
let pendingLanguage = currentLanguage;
let pendingCurrency = currentCurrency;
let setupEditing = false;
let setupSnapshot = null;
let pendingDeleteId = null;
let toastTimer = null;
let moneyFormatter;
let dateFormatter;

function currentLocale() {
  return languageByCode.get(currentLanguage)?.locale || "en";
}

function t(key, variables = {}) {
  const template = messages[currentLanguage]?.[key] ?? messages.en[key] ?? key;
  return String(template).replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(variables, name) ? String(variables[name]) : match,
  );
}

function refreshFormatters() {
  const locale = currentLocale();
  try { moneyFormatter = new Intl.NumberFormat(locale, { style: "currency", currency: currentCurrency }); }
  catch {
    currentCurrency = "USD";
    moneyFormatter = new Intl.NumberFormat(locale, { style: "currency", currency: currentCurrency });
  }
  dateFormatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
}

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function dateFromToday(offset) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function sampleRepairs() {
  const now = Date.now();
  return [
    {
      id: "sample-iphone-14", sampleKey: "iphone", device: "Apple iPhone 14", category: "smartphone",
      issue: messages.en.sampleIphoneIssue, issueKey: "sampleIphoneIssue", serial: "", status: "in-progress",
      received: dateFromToday(-2), target: dateFromToday(1), labour: 65,
      parts: [{ id: "sample-iphone-display", name: messages.en.sampleIphonePart, nameKey: "sampleIphonePart", cost: 189.9 }],
      notes: messages.en.sampleIphoneNote, notesKey: "sampleIphoneNote",
      createdAt: new Date(now - 2 * 86400000).toISOString(), updatedAt: new Date(now - 5 * 3600000).toISOString(),
    },
    {
      id: "sample-samsung-s23", sampleKey: "samsung", device: "Samsung Galaxy S23", category: "smartphone",
      issue: messages.en.sampleSamsungIssue, issueKey: "sampleSamsungIssue", serial: "", status: "waiting",
      received: dateFromToday(-1), target: dateFromToday(3), labour: 45,
      parts: [{ id: "sample-samsung-board", name: messages.en.sampleSamsungPart, nameKey: "sampleSamsungPart", cost: 39.5 }],
      notes: messages.en.sampleSamsungNote, notesKey: "sampleSamsungNote",
      createdAt: new Date(now - 86400000).toISOString(), updatedAt: new Date(now - 3 * 3600000).toISOString(),
    },
    {
      id: "sample-lenovo-ideapad-5", sampleKey: "laptop", device: "Lenovo IdeaPad 5", category: "laptop",
      issue: messages.en.sampleLaptopIssue, issueKey: "sampleLaptopIssue", serial: "", status: "completed",
      received: dateFromToday(-6), target: dateFromToday(-3), labour: 55,
      parts: [{ id: "sample-laptop-fan", name: messages.en.sampleLaptopPart, nameKey: "sampleLaptopPart", cost: 28 }],
      notes: messages.en.sampleLaptopNote, notesKey: "sampleLaptopNote",
      createdAt: new Date(now - 6 * 86400000).toISOString(), updatedAt: new Date(now - 3 * 86400000).toISOString(),
    },
    {
      id: "sample-playstation-5", sampleKey: "console", device: "Sony PlayStation 5", category: "console",
      issue: messages.en.sampleConsoleIssue, issueKey: "sampleConsoleIssue", serial: "", status: "in-progress",
      received: dateFromToday(-4), target: dateFromToday(2), labour: 80,
      parts: [{ id: "sample-console-hdmi", name: messages.en.sampleConsolePart, nameKey: "sampleConsolePart", cost: 14.9 }],
      notes: messages.en.sampleConsoleNote, notesKey: "sampleConsoleNote",
      createdAt: new Date(now - 4 * 86400000).toISOString(), updatedAt: new Date(now - 8 * 3600000).toISOString(),
    },
  ];
}

function isLegacySampleSet(items) {
  if (!Array.isArray(items) || items.length !== 3) return false;
  const expected = new Map([
    ["Samsung Galaxy S22 Ultra", "Water damage and damaged display"],
    ["iPhone 12 mini", "Battery replacement and charging check"],
    ["Lenovo ThinkPad X1 Carbon", "USB-C port disconnects under load"],
  ]);
  return items.every((item) => expected.get(item?.device) === item?.issue);
}

function normalizeCategory(category) {
  if (validCategories.has(category)) return category;
  return categoryAliases[category] || "other";
}

function normalizeRepair(repair) {
  const parts = Array.isArray(repair.parts)
    ? repair.parts.map((part) => ({
        id: part.id || createId(), name: String(part.name || messages.en.partFallback),
        nameKey: part.nameKey ? String(part.nameKey) : "", cost: toAmount(part.cost),
      }))
    : [];
  return {
    id: repair.id || createId(), sampleKey: repair.sampleKey ? String(repair.sampleKey) : "",
    device: String(repair.device || messages.en.unnamedDevice), category: normalizeCategory(repair.category),
    issue: String(repair.issue || messages.en.noIssue), issueKey: repair.issueKey ? String(repair.issueKey) : "",
    serial: String(repair.serial || ""), status: validStatuses.has(repair.status) ? repair.status : "waiting",
    received: String(repair.received || ""), target: String(repair.target || ""), labour: toAmount(repair.labour), parts,
    notes: String(repair.notes || ""), notesKey: repair.notesKey ? String(repair.notesKey) : "",
    createdAt: repair.createdAt || new Date().toISOString(), updatedAt: repair.updatedAt || new Date().toISOString(),
  };
}

function loadRepairs() {
  const stored = readStorage(STORAGE_KEY);
  if (!stored) {
    const samples = sampleRepairs();
    writeStorage(STORAGE_KEY, JSON.stringify(samples));
    return samples.map(normalizeRepair);
  }
  try {
    const parsed = JSON.parse(stored);
    if (isLegacySampleSet(parsed)) {
      const samples = sampleRepairs();
      writeStorage(STORAGE_KEY, JSON.stringify(samples));
      return samples.map(normalizeRepair);
    }
    return Array.isArray(parsed) ? parsed.map(normalizeRepair) : [];
  } catch { return []; }
}

let repairs = loadRepairs();

function saveRepairs() {
  if (!writeStorage(STORAGE_KEY, JSON.stringify(repairs))) showToast(t("saveFailed"));
}

function saveSettings() {
  writeStorage(SETTINGS_KEY, JSON.stringify({ language: currentLanguage, currency: currentCurrency, setupComplete: true }));
}

function toAmount(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 10000) / 10000 : 0;
}

function getRepairTotal(repair) {
  const partsTotal = repair.parts.reduce((sum, part) => sum + toAmount(part.cost), 0);
  return Math.round((partsTotal + toAmount(repair.labour)) * 10000) / 10000;
}

function formatMoney(value) { return moneyFormatter.format(toAmount(value)); }

function formatMoneyFor(value, language, currency) {
  const locale = languageByCode.get(language)?.locale || "en";
  try { return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value); }
  catch { return `${currency} ${value}`; }
}

function currencySymbol() {
  return moneyFormatter.formatToParts(0).find((item) => item.type === "currency")?.value || currentCurrency;
}

function currencyFractionDigits() { return moneyFormatter.resolvedOptions().maximumFractionDigits; }

function formatDate(value) {
  if (!value) return t("notSet");
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? t("notSet") : dateFormatter.format(date);
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function getIssue(repair) {
  return repair.issueKey && messages[currentLanguage]?.[repair.issueKey] ? t(repair.issueKey) : repair.issue;
}

function getNotes(repair) {
  return repair.notesKey && messages[currentLanguage]?.[repair.notesKey] ? t(repair.notesKey) : repair.notes;
}

function getPartName(part) {
  return part.nameKey && messages[currentLanguage]?.[part.nameKey] ? t(part.nameKey) : part.name;
}

function setMultilineText(element, value) {
  const lines = String(value).split("\n");
  element.replaceChildren();
  lines.forEach((line, index) => {
    if (index) element.append(document.createElement("br"));
    element.append(document.createTextNode(line));
  });
}

function updateThemeLabel() {
  elements.themeLabel.textContent = t(document.documentElement.dataset.theme === "dark" ? "lightMode" : "darkMode");
}

function updateCurrencyUI() {
  const symbol = currencySymbol();
  const inputPadding = Math.min(78, Math.max(34, 20 + [...symbol].length * 9));
  document.documentElement.style.setProperty("--currency-input-padding", `${inputPadding}px`);
  document.querySelectorAll(".currency-symbol").forEach((element) => { element.textContent = symbol; });
  elements.currencyStatSymbol.textContent = symbol;
  const fractionDigits = currencyFractionDigits();
  const step = fractionDigits ? 1 / 10 ** fractionDigits : 1;
  elements.labourInput.step = String(step);
  elements.partsList.querySelectorAll(".part-cost").forEach((input) => { input.step = String(step); });
  updateFormTotal();
}

function applyTranslations() {
  const language = languageByCode.get(currentLanguage) || languageByCode.get("en");
  document.documentElement.lang = language.locale;
  document.documentElement.dir = language.dir;
  document.title = t("pageTitle");
  document.querySelector('meta[name="description"]').content = t("pageDescription");
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (key === "heroTitle") setMultilineText(element, t(key)); else element.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAria));
  });
  refreshFormatters();
  updateThemeLabel();
  elements.preferencesLabel.textContent = `${language.nativeName} · ${currentCurrency}`;
  elements.dialogTitle.textContent = elements.repairId.value ? t("editRepair") : t("newRepair");
  elements.submitButtonLabel.textContent = elements.repairId.value ? t("updateRepair") : t("saveRepair");
  elements.finishSetupButton.textContent = t(setupEditing ? "savePreferences" : "start");
  updateCurrencyUI();
  render();
}

function render() { renderStats(); renderRepairCards(); }

function renderStats() {
  const waiting = repairs.filter((repair) => repair.status === "waiting").length;
  const inProgress = repairs.filter((repair) => repair.status === "in-progress").length;
  const completed = repairs.filter((repair) => repair.status === "completed").length;
  const active = waiting + inProgress;
  const total = repairs.reduce((sum, repair) => sum + getRepairTotal(repair), 0);
  elements.activeCount.textContent = active;
  elements.waitingCount.textContent = waiting;
  elements.completedCount.textContent = completed;
  elements.totalSpent.textContent = formatMoney(total);
  elements.activeHint.textContent = active ? t("activeHint", { progress: inProgress, waiting }) : t("noActive");
  elements.completedHint.textContent = completed ? t("completedHint", { count: completed }) : t("finishedRepairs");
}

function filteredRepairs() {
  const query = elements.searchInput.value.trim().toLocaleLowerCase(currentLocale());
  const status = elements.statusFilter.value;
  const matches = repairs.filter((repair) => {
    const searchable = [repair.device, t(repair.category), getIssue(repair), repair.serial, getNotes(repair),
      ...repair.parts.map(getPartName)].join(" ").toLocaleLowerCase(currentLocale());
    return (!query || searchable.includes(query)) && (status === "all" || repair.status === status);
  });
  return matches.sort((first, second) => {
    switch (elements.sortSelect.value) {
      case "oldest": return new Date(first.createdAt) - new Date(second.createdAt);
      case "cost-high": return getRepairTotal(second) - getRepairTotal(first);
      case "cost-low": return getRepairTotal(first) - getRepairTotal(second);
      default: return new Date(second.createdAt) - new Date(first.createdAt);
    }
  });
}

function renderRepairCards() {
  const visibleRepairs = filteredRepairs();
  const hasFilters = elements.searchInput.value.trim() || elements.statusFilter.value !== "all";
  elements.repairGrid.replaceChildren();
  elements.resultCount.textContent = t("repairsCount", { count: visibleRepairs.length });
  elements.emptyState.hidden = visibleRepairs.length > 0;
  elements.repairGrid.hidden = visibleRepairs.length === 0;
  if (!visibleRepairs.length) {
    elements.emptyTitle.textContent = t(hasFilters ? "noMatches" : "noRepairs");
    elements.emptyCopy.textContent = t(hasFilters ? "filterEmpty" : "emptyCopy");
    elements.emptyAddButton.hidden = Boolean(hasFilters);
    return;
  }
  visibleRepairs.forEach((repair) => {
    const card = document.createElement("article");
    card.className = "repair-card";
    card.dataset.id = repair.id;
    card.dataset.status = repair.status;
    const partsLabel = repair.parts.length ? t("partsCount", { count: repair.parts.length }) : t("noParts");
    const dateLabel = repair.status === "completed" ? t("completedBy") : t("targetDate");
    card.innerHTML = `
      <div class="repair-card-top"><div><p class="device-type">${escapeHtml(t(repair.category))}</p>
      <h3>${escapeHtml(repair.device)}</h3></div>
      <span class="status-badge ${escapeHtml(repair.status)}">${escapeHtml(t(repair.status === "in-progress" ? "inProgress" : repair.status))}</span></div>
      <p class="repair-issue">${escapeHtml(getIssue(repair))}</p>
      <div class="repair-meta"><div class="meta-item"><span>${escapeHtml(t("received"))}</span>
      <strong>${escapeHtml(formatDate(repair.received))}</strong></div><div class="meta-item"><span>${escapeHtml(dateLabel)}</span>
      <strong>${escapeHtml(formatDate(repair.target))}</strong></div></div>
      <div class="repair-card-bottom"><div class="repair-cost"><span>${escapeHtml(partsLabel)}</span>
      <strong>${escapeHtml(formatMoney(getRepairTotal(repair)))}</strong></div><div class="card-actions">
      <button class="card-button edit-button" type="button" data-action="edit" aria-label="${escapeHtml(t("editDevice", { device: repair.device }))}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-.8 4 4-.8L18 8.4 15.6 6 4 16Zm9.8-8.2 2.4 2.4" /></svg><span>${escapeHtml(t("edit"))}</span></button>
      <button class="card-button delete-button" type="button" data-action="delete" aria-label="${escapeHtml(t("deleteDevice", { device: repair.device }))}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg><span>${escapeHtml(t("delete"))}</span></button>
      </div></div>`;
    elements.repairGrid.append(card);
  });
}

function resetFormErrors() {
  [elements.deviceInput, elements.issueInput].forEach((input) => input.closest(".field").classList.remove("has-error"));
  elements.deviceError.textContent = "";
  elements.issueError.textContent = "";
}

function openNewRepair() {
  elements.repairForm.reset();
  resetFormErrors();
  elements.repairId.value = "";
  elements.dialogTitle.textContent = t("newRepair");
  elements.submitButtonLabel.textContent = t("saveRepair");
  elements.categoryInput.value = "smartphone";
  elements.statusInput.value = "in-progress";
  elements.receivedInput.value = dateFromToday(0);
  elements.targetInput.value = "";
  elements.targetInput.min = elements.receivedInput.value;
  elements.labourInput.value = "0";
  elements.partsList.replaceChildren();
  addPartRow();
  updateFormTotal();
  elements.repairDialog.showModal();
  requestAnimationFrame(() => elements.deviceInput.focus());
}

function openEditRepair(repairId) {
  const repair = repairs.find((item) => item.id === repairId);
  if (!repair) return;
  elements.repairForm.reset();
  resetFormErrors();
  elements.repairId.value = repair.id;
  elements.dialogTitle.textContent = t("editRepair");
  elements.submitButtonLabel.textContent = t("updateRepair");
  elements.deviceInput.value = repair.device;
  elements.categoryInput.value = repair.category;
  elements.statusInput.value = repair.status;
  elements.issueInput.value = getIssue(repair);
  elements.serialInput.value = repair.serial;
  elements.receivedInput.value = repair.received;
  elements.targetInput.value = repair.target;
  elements.targetInput.min = repair.received;
  elements.labourInput.value = repair.labour;
  elements.notesInput.value = getNotes(repair);
  elements.partsList.replaceChildren();
  (repair.parts.length ? repair.parts : [{}]).forEach((part) => addPartRow({ ...part, name: getPartName(part) }));
  updateFormTotal();
  elements.repairDialog.showModal();
  requestAnimationFrame(() => elements.deviceInput.focus());
}

function closeRepairDialog() { elements.repairDialog.close(); }

function localisePartRow(fragment) {
  const nameInput = fragment.querySelector(".part-name");
  const costInput = fragment.querySelector(".part-cost");
  nameInput.placeholder = t("partName");
  costInput.setAttribute("aria-label", t("partCost"));
  costInput.step = String(currencyFractionDigits() ? 1 / 10 ** currencyFractionDigits() : 1);
  fragment.querySelector(".remove-part").setAttribute("aria-label", t("removePart"));
  fragment.querySelector(".currency-symbol").textContent = currencySymbol();
}

function addPartRow(part = {}) {
  const fragment = elements.partRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".part-row");
  row.dataset.partId = part.id || createId();
  fragment.querySelector(".part-name").value = part.name || "";
  fragment.querySelector(".part-cost").value = toAmount(part.cost);
  localisePartRow(fragment);
  elements.partsList.append(fragment);
}

function readParts() {
  return [...elements.partsList.querySelectorAll(".part-row")]
    .map((row) => {
      const name = row.querySelector(".part-name").value.trim();
      const cost = toAmount(row.querySelector(".part-cost").value);
      return { id: row.dataset.partId || createId(), name: name || t("partFallback"), cost, isEmpty: !name && cost === 0 };
    })
    .filter((part) => !part.isEmpty)
    .map(({ isEmpty, ...part }) => part);
}

function updateFormTotal() {
  if (!moneyFormatter) return;
  const partsTotal = [...elements.partsList.querySelectorAll(".part-cost")]
    .reduce((sum, input) => sum + toAmount(input.value), 0);
  elements.formTotal.textContent = formatMoney(partsTotal + toAmount(elements.labourInput.value));
}

function validateRepairForm() {
  resetFormErrors();
  let isValid = true;
  if (!elements.deviceInput.value.trim()) {
    elements.deviceInput.closest(".field").classList.add("has-error");
    elements.deviceError.textContent = t("validationDevice");
    isValid = false;
  }
  if (!elements.issueInput.value.trim()) {
    elements.issueInput.closest(".field").classList.add("has-error");
    elements.issueError.textContent = t("validationIssue");
    isValid = false;
  }
  if (!elements.receivedInput.value) {
    elements.receivedInput.focus();
    isValid = false;
  }
  if (!isValid) elements.repairForm.querySelector(".has-error input")?.focus();
  return isValid;
}

function saveRepairFromForm(event) {
  event.preventDefault();
  if (!validateRepairForm()) return;
  const existingId = elements.repairId.value;
  const existing = repairs.find((repair) => repair.id === existingId);
  const now = new Date().toISOString();
  const repair = normalizeRepair({
    id: existingId || createId(), device: elements.deviceInput.value.trim(), category: elements.categoryInput.value,
    status: elements.statusInput.value, issue: elements.issueInput.value.trim(), serial: elements.serialInput.value.trim(),
    received: elements.receivedInput.value, target: elements.targetInput.value, labour: elements.labourInput.value,
    parts: readParts(), notes: elements.notesInput.value.trim(), createdAt: existing?.createdAt || now, updatedAt: now,
  });
  repairs = existing ? repairs.map((item) => (item.id === repair.id ? repair : item)) : [repair, ...repairs];
  saveRepairs();
  render();
  closeRepairDialog();
  showToast(t(existing ? "updated" : "added"));
}

function requestDelete(repairId) {
  if (!repairs.some((repair) => repair.id === repairId)) return;
  pendingDeleteId = repairId;
  elements.confirmDialog.showModal();
}

function deletePendingRepair() {
  if (!pendingDeleteId) return;
  repairs = repairs.filter((repair) => repair.id !== pendingDeleteId);
  pendingDeleteId = null;
  saveRepairs();
  render();
  elements.confirmDialog.close();
  showToast(t("deleted"));
}

function closeDeleteDialog() {
  pendingDeleteId = null;
  elements.confirmDialog.close();
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 2600);
}

function setTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]').content = isDark ? "#111714" : "#f4f2ed";
  writeStorage(THEME_KEY, isDark ? "dark" : "light");
  updateThemeLabel();
}

function initialiseTheme() {
  const savedTheme = readStorage(THEME_KEY);
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  setTheme(savedTheme || systemTheme);
}

function toggleTheme() {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
}

function currencyName(code, language = currentLanguage) {
  const locale = languageByCode.get(language)?.locale || "en";
  try {
    const name = new Intl.DisplayNames([locale], { type: "currency" }).of(code);
    return name && name !== code ? name : code;
  } catch { return code; }
}

function renderLanguageGrid() {
  elements.languageGrid.replaceChildren();
  languages.forEach((language) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "language-option";
    button.dataset.language = language.code;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(language.code === pendingLanguage));
    if (language.code === pendingLanguage) button.classList.add("selected");
    const nativeName = document.createElement("strong");
    nativeName.textContent = language.nativeName;
    const englishName = document.createElement("span");
    englishName.textContent = language.englishName;
    const marker = document.createElement("i");
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = language.code.toUpperCase();
    button.append(nativeName, englishName, marker);
    elements.languageGrid.append(button);
  });
}

function populateCurrencyOptions() {
  const selected = currencies.includes(pendingCurrency) ? pendingCurrency : detectCurrency(pendingLanguage);
  elements.currencySelect.replaceChildren();
  currencies.forEach((code) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = `${code} — ${currencyName(code, pendingLanguage)}`;
    elements.currencySelect.append(option);
  });
  elements.currencySelect.value = selected;
  pendingCurrency = elements.currencySelect.value || "USD";
  updateCurrencyPreview();
}

function updateCurrencyPreview() {
  elements.currencyPreview.textContent = formatMoneyFor(1234.56, pendingLanguage, pendingCurrency);
}

function showSetupStep(step) {
  const isLanguage = step === "language";
  elements.languageStep.hidden = !isLanguage;
  elements.currencyStep.hidden = isLanguage;
  elements.setupProgress[0].classList.toggle("active", true);
  elements.setupProgress[1].classList.toggle("active", !isLanguage);
  elements.setupDialog.setAttribute("aria-labelledby", isLanguage ? "setupTitle" : "currencySetupTitle");
  if (!isLanguage) {
    populateCurrencyOptions();
    requestAnimationFrame(() => elements.currencySelect.focus());
  }
}

function openSetup(editing) {
  setupEditing = editing;
  setupSnapshot = { language: currentLanguage, currency: currentCurrency };
  pendingLanguage = currentLanguage;
  pendingCurrency = currentCurrency;
  elements.setupCloseButton.hidden = !editing;
  elements.finishSetupButton.textContent = t(editing ? "savePreferences" : "start");
  renderLanguageGrid();
  showSetupStep("language");
  if (!elements.setupDialog.open) elements.setupDialog.showModal();
}

function selectLanguage(language) {
  if (!languageByCode.has(language)) return;
  pendingLanguage = language;
  currentLanguage = language;
  applyTranslations();
  renderLanguageGrid();
}

function finishSetup() {
  currentLanguage = pendingLanguage;
  currentCurrency = currencies.includes(pendingCurrency) ? pendingCurrency : detectCurrency(currentLanguage);
  setupComplete = true;
  saveSettings();
  applyTranslations();
  elements.setupDialog.close();
  setupSnapshot = null;
}

function cancelSetup() {
  if (!setupEditing || !setupSnapshot) return;
  currentLanguage = setupSnapshot.language;
  currentCurrency = setupSnapshot.currency;
  pendingLanguage = currentLanguage;
  pendingCurrency = currentCurrency;
  applyTranslations();
  elements.setupDialog.close();
  setupSnapshot = null;
}

function closeDialogFromBackdrop(event) {
  const dialog = event.currentTarget;
  const bounds = dialog.getBoundingClientRect();
  const outside = event.clientX < bounds.left || event.clientX > bounds.right ||
    event.clientY < bounds.top || event.clientY > bounds.bottom;
  if (outside) dialog.close();
}

elements.addRepairButton.addEventListener("click", openNewRepair);
elements.emptyAddButton.addEventListener("click", openNewRepair);
elements.closeDialogButton.addEventListener("click", closeRepairDialog);
elements.cancelButton.addEventListener("click", closeRepairDialog);
elements.repairForm.addEventListener("submit", saveRepairFromForm);
elements.addPartButton.addEventListener("click", () => addPartRow());
elements.themeToggle.addEventListener("click", toggleTheme);
elements.mobileThemeToggle.addEventListener("click", toggleTheme);
elements.preferencesButton.addEventListener("click", () => openSetup(true));
elements.mobilePreferencesButton.addEventListener("click", () => openSetup(true));
elements.searchInput.addEventListener("input", renderRepairCards);
elements.statusFilter.addEventListener("change", renderRepairCards);
elements.sortSelect.addEventListener("change", renderRepairCards);
elements.cancelDeleteButton.addEventListener("click", closeDeleteDialog);
elements.confirmDeleteButton.addEventListener("click", deletePendingRepair);
elements.repairDialog.addEventListener("click", closeDialogFromBackdrop);
elements.confirmDialog.addEventListener("click", closeDialogFromBackdrop);

elements.receivedInput.addEventListener("change", () => {
  elements.targetInput.min = elements.receivedInput.value;
  if (elements.targetInput.value && elements.targetInput.value < elements.receivedInput.value) {
    elements.targetInput.value = elements.receivedInput.value;
  }
});

elements.dialogTitle.closest(".dialog-header").addEventListener("click", (event) => event.stopPropagation());
elements.partsList.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".remove-part");
  if (!removeButton) return;
  removeButton.closest(".part-row").remove();
  if (!elements.partsList.children.length) addPartRow();
  updateFormTotal();
});
elements.partsList.addEventListener("input", updateFormTotal);
elements.labourInput.addEventListener("input", updateFormTotal);

elements.repairGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  const card = button?.closest(".repair-card");
  if (!button || !card) return;
  if (button.dataset.action === "edit") openEditRepair(card.dataset.id);
  else if (button.dataset.action === "delete") requestDelete(card.dataset.id);
});

elements.repairDialog.addEventListener("close", resetFormErrors);
elements.confirmDialog.addEventListener("close", () => { pendingDeleteId = null; });
document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((link) => link.classList.remove("active"));
    item.classList.add("active");
  });
});

elements.languageGrid.addEventListener("click", (event) => {
  const option = event.target.closest("[data-language]");
  if (option) selectLanguage(option.dataset.language);
});
elements.languageContinueButton.addEventListener("click", () => showSetupStep("currency"));
elements.currencyBackButton.addEventListener("click", () => showSetupStep("language"));
elements.currencySelect.addEventListener("change", () => {
  pendingCurrency = elements.currencySelect.value;
  updateCurrencyPreview();
});
elements.finishSetupButton.addEventListener("click", finishSetup);
elements.setupCloseButton.addEventListener("click", cancelSetup);
elements.setupDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  if (setupEditing) cancelSetup();
});

initialiseTheme();
refreshFormatters();
applyTranslations();
if (!setupComplete) openSetup(false);
