const STORAGE_KEY = "repairdesk.repairs.v1";
const SETTINGS_KEY = "repairdesk.settings.v1";
const THEME_KEY = "repairdesk.theme";
const SETUP_VERSION = 2;

const { languages, messages } = RepairDeskI18n;
const { countries, countryByCode, providerList, buildUrl, shoppingUrl, webSearchUrl, recommendedDomains } = RepairDeskCatalog;
const languageByCode = new Map(languages.map((language) => [language.code, language]));
const countryCodes = new Set(countries.map((country) => country.code));
const validStatuses = new Set(["waiting", "in-progress", "completed"]);
const validCategories = new Set(["smartphone", "tablet", "laptop", "desktop", "console", "other"]);
const categoryAliases = { Smartphone: "smartphone", Tablet: "tablet", Laptop: "laptop", "Desktop PC": "desktop", "Game console": "console", Other: "other" };
const defaultCountryByLanguage = Object.fromEntries(countries.map((country) => [country.language, country.code]));

const fallbackCurrencies = (
  "AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BOV BRL BSD BTN BWP BYN BZD " +
  "CAD CDF CHE CHF CHW CLF CLP CNY COP COU CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL " +
  "GHS GIP GMD GNF GTQ GYD HKD HNL HRK HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW " +
  "KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MXV MYR MZN " +
  "NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP " +
  "SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD USN UYI UYU UYW UZS " +
  "VED VES VND VUV WST XAF XAG XAU XBA XBB XBC XBD XCD XCG XDR XOF XPD XPF XPT XSU XUA YER ZAR ZMW ZWG"
).split(" ");

const elements = Object.fromEntries([
  "activeCount", "activeHint", "waitingCount", "completedCount", "completedHint", "totalSpent", "currencyStatSymbol",
  "resultCount", "repairGrid", "emptyState", "emptyTitle", "emptyCopy", "searchInput", "statusFilter", "sortSelect",
  "themeToggle", "mobileThemeToggle", "themeLabel", "preferencesLabel", "addRepairButton", "emptyAddButton", "repairDialog",
  "repairForm", "repairId", "dialogTitle", "closeDialogButton", "cancelButton", "deviceInput", "categoryInput", "statusInput",
  "issueInput", "serialInput", "receivedInput", "targetInput", "labourInput", "notesInput", "deviceError", "issueError",
  "customerNameInput", "customerPhoneInput", "customerEmailInput", "customerAddressInput", "addPartButton", "partsList",
  "partRowTemplate", "formTotal", "confirmDialog", "cancelDeleteButton", "confirmDeleteButton", "toast", "setupDialog",
  "languageStep", "countryStep", "currencyStep", "languageGrid", "countryGrid", "languageContinueButton", "countryBackButton",
  "countryContinueButton", "currencySelect", "currencyPreview", "currencyBackButton", "finishSetupButton", "historySearch",
  "historyRepairList", "timelineEmpty", "timelineContent", "timelineCategory", "timelineDevice", "timelineIssue", "timeline",
  "timelineNoteForm", "timelineNoteInput", "editFromHistoryButton", "settingsForm", "settingsLanguage", "settingsCountry",
  "settingsCurrency", "workshopNameInput", "workshopAddressInput", "workshopCityInput", "workshopPostcodeInput",
  "workshopPhoneInput", "workshopEmailInput", "workshopTaxIdInput", "invoicePrefixInput", "taxRateInput", "paymentDetailsInput",
  "searchEngineIdInput", "testSearchButton", "domainCountryLabel", "recommendedDomains", "copyDomainsButton", "finderDialog",
  "finderTitle", "finderContext", "closeFinderButton", "finderSearchForm", "finderQueryInput", "finderCountryLabel",
  "providerLinks", "finderStatus", "pricePanel", "priceChart", "priceSummary", "offerGrid", "googleResultsHost",
  "documentDialog", "documentDialogTitle", "documentSheet", "printDocumentButton", "closeDocumentButton",
].map((id) => [id, document.getElementById(id)]));

elements.submitButtonLabel = document.getElementById("submitButtonLabel");
elements.setupProgress = document.querySelectorAll(".setup-progress span");

function readStorage(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function detectLanguage() {
  const locales = navigator.languages?.length ? navigator.languages : [navigator.language || "en"];
  for (const locale of locales) {
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
    return fallbackCurrencies;
  }
  return fallbackCurrencies;
}

const currencies = [...new Set(supportedCurrencies())].sort();

function detectCountry(language) {
  const region = browserRegion();
  return countryCodes.has(region) ? region : defaultCountryByLanguage[language] || "US";
}

function detectCurrency(countryCode) {
  return countryByCode.get(countryCode)?.currency || "USD";
}

function emptyWorkshop() {
  return { name: "", address: "", city: "", postcode: "", phone: "", email: "", taxId: "", invoicePrefix: "RD", taxRate: 0, paymentDetails: "" };
}

function loadSettings() {
  const detectedLanguage = detectLanguage();
  const detectedCountry = detectCountry(detectedLanguage);
  const fallback = {
    language: detectedLanguage,
    country: detectedCountry,
    currency: detectCurrency(detectedCountry),
    setupComplete: false,
    setupVersion: 0,
    workshop: emptyWorkshop(),
    search: { engineId: "" },
  };
  const stored = readStorage(SETTINGS_KEY);
  if (!stored) return fallback;
  try {
    const parsed = JSON.parse(stored);
    const language = languageByCode.has(parsed.language) ? parsed.language : fallback.language;
    const country = countryCodes.has(parsed.country) ? parsed.country : detectCountry(language);
    const currency = currencies.includes(parsed.currency) ? parsed.currency : detectCurrency(country);
    return {
      language,
      country,
      currency,
      setupComplete: Boolean(parsed.setupComplete),
      setupVersion: Number(parsed.setupVersion) || 0,
      workshop: { ...emptyWorkshop(), ...(parsed.workshop || {}) },
      search: { engineId: String(parsed.search?.engineId || "").trim() },
    };
  } catch { return fallback; }
}

const settings = loadSettings();
let currentLanguage = settings.language;
let currentCountry = settings.country;
let currentCurrency = settings.currency;
let pendingLanguage = currentLanguage;
let pendingCountry = currentCountry;
let pendingCurrency = currentCurrency;
let pendingDeleteId = null;
let selectedHistoryId = null;
let activeView = "overview";
let toastTimer = null;
let moneyFormatter;
let dateFormatter;
let dateTimeFormatter;
let finderRow = null;
let currentOffers = [];
let googleSearchPromise = null;
let googleSearchEngineId = "";

function currentLocale() {
  return languageByCode.get(currentLanguage)?.locale || "en";
}

function t(key, variables = {}) {
  const template = messages[currentLanguage]?.[key] ?? messages.en[key] ?? key;
  return String(template).replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(variables, name) ? String(variables[name]) : match);
}

function refreshFormatters() {
  const locale = currentLocale();
  try { moneyFormatter = new Intl.NumberFormat(locale, { style: "currency", currency: currentCurrency }); }
  catch {
    currentCurrency = "USD";
    moneyFormatter = new Intl.NumberFormat(locale, { style: "currency", currency: currentCurrency });
  }
  dateFormatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  dateTimeFormatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function toAmount(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function formatMoney(value) { return moneyFormatter.format(toAmount(value)); }

function formatMoneyFor(value, language, currency) {
  const locale = languageByCode.get(language)?.locale || "en";
  try { return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value); }
  catch { return `${currency} ${Number(value).toFixed(2)}`; }
}

function currencySymbol() {
  return moneyFormatter.formatToParts(0).find((part) => part.type === "currency")?.value || currentCurrency;
}

function currencyFractionDigits() { return moneyFormatter.resolvedOptions().maximumFractionDigits; }

function formatDate(value) {
  if (!value) return t("notSet");
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? t("notSet") : dateFormatter.format(date);
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? t("notSet") : dateTimeFormatter.format(date);
}

function dateFromToday(offset) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function safeUrl(value) {
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

function countryName(code, language = currentLanguage) {
  const locale = languageByCode.get(language)?.locale || "en";
  try { return new Intl.DisplayNames([locale], { type: "region" }).of(code) || code; }
  catch { return code; }
}

function currencyName(code, language = currentLanguage) {
  const locale = languageByCode.get(language)?.locale || "en";
  try {
    const name = new Intl.DisplayNames([locale], { type: "currency" }).of(code);
    return name && name !== code ? name : code;
  } catch { return code; }
}

function flagEmoji(code) {
  return [...code].map((character) => String.fromCodePoint(127397 + character.charCodeAt(0))).join("");
}

function getRepairTotal(repair) {
  return toAmount(repair.labour) + repair.parts.reduce((sum, part) => sum + toAmount(part.cost), 0);
}

function normalizeCategory(category) {
  if (validCategories.has(category)) return category;
  return categoryAliases[category] || "other";
}

function normalizeOrder(order) {
  if (!order || !["waiting", "received"].includes(order.status)) return null;
  return {
    status: order.status,
    vendor: String(order.vendor || "").slice(0, 100),
    title: String(order.title || "").slice(0, 220),
    url: safeUrl(order.url),
    image: safeUrl(order.image),
    price: toAmount(order.price),
    currency: currencies.includes(order.currency) ? order.currency : currentCurrency,
    orderedAt: order.orderedAt || new Date().toISOString(),
    receivedAt: order.status === "received" ? (order.receivedAt || new Date().toISOString()) : "",
  };
}

function normalizePart(part) {
  return {
    id: part?.id || createId(),
    name: String(part?.name || messages.en.partFallback).slice(0, 80),
    ...(part?.nameKey ? { nameKey: part.nameKey } : {}),
    cost: toAmount(part?.cost),
    order: normalizeOrder(part?.order),
  };
}

function normalizeHistoryEvent(event) {
  const allowed = new Set(["created", "updated", "status", "part-added", "part-removed", "part-ordered", "part-received", "note", "document"]);
  return { id: event?.id || createId(), type: allowed.has(event?.type) ? event.type : "updated", at: event?.at || new Date().toISOString(), data: event?.data && typeof event.data === "object" ? event.data : {} };
}

function initialHistory(repair) {
  const history = [{ id: createId(), type: "created", at: repair.createdAt, data: {} }];
  if (repair.status === "completed") history.push({ id: createId(), type: "status", at: repair.updatedAt, data: { from: "in-progress", to: "completed" } });
  return history;
}

function normalizeRepair(repair) {
  const createdAt = repair?.createdAt || new Date().toISOString();
  const updatedAt = repair?.updatedAt || createdAt;
  const normalized = {
    id: repair?.id || createId(),
    ...(repair?.sampleKey ? { sampleKey: repair.sampleKey } : {}),
    device: String(repair?.device || "").slice(0, 80),
    category: normalizeCategory(repair?.category),
    issue: String(repair?.issue || "").slice(0, 120),
    ...(repair?.issueKey ? { issueKey: repair.issueKey } : {}),
    serial: String(repair?.serial || "").slice(0, 60),
    status: validStatuses.has(repair?.status) ? repair.status : "in-progress",
    received: repair?.received || "",
    target: repair?.target || "",
    labour: toAmount(repair?.labour),
    parts: Array.isArray(repair?.parts) ? repair.parts.map(normalizePart) : [],
    notes: String(repair?.notes || "").slice(0, 600),
    ...(repair?.notesKey ? { notesKey: repair.notesKey } : {}),
    customer: {
      name: String(repair?.customer?.name || "").slice(0, 100),
      phone: String(repair?.customer?.phone || "").slice(0, 40),
      email: String(repair?.customer?.email || "").slice(0, 100),
      address: String(repair?.customer?.address || "").slice(0, 160),
    },
    documents: repair?.documents && typeof repair.documents === "object" ? repair.documents : {},
    createdAt,
    updatedAt,
  };
  normalized.history = Array.isArray(repair?.history) && repair.history.length ? repair.history.map(normalizeHistoryEvent) : initialHistory(normalized);
  return normalized;
}

function sampleRepairs() {
  const now = Date.now();
  const base = [
    ["sample-iphone-14", "iphone", "Apple iPhone 14", "smartphone", "sampleIphoneIssue", "in-progress", -2, 1, 65, "sample-iphone-display", "sampleIphonePart", 189.9, "sampleIphoneNote"],
    ["sample-samsung-s23", "samsung", "Samsung Galaxy S23", "smartphone", "sampleSamsungIssue", "waiting", -1, 3, 45, "sample-samsung-board", "sampleSamsungPart", 39.5, "sampleSamsungNote"],
    ["sample-lenovo-ideapad-5", "laptop", "Lenovo IdeaPad 5", "laptop", "sampleLaptopIssue", "completed", -6, -3, 55, "sample-laptop-fan", "sampleLaptopPart", 28, "sampleLaptopNote"],
    ["sample-playstation-5", "console", "Sony PlayStation 5", "console", "sampleConsoleIssue", "in-progress", -4, 2, 80, "sample-console-hdmi", "sampleConsolePart", 14.9, "sampleConsoleNote"],
  ];
  return base.map(([id, sampleKey, device, category, issueKey, status, receivedOffset, targetOffset, labour, partId, partKey, cost, notesKey]) => normalizeRepair({
    id, sampleKey, device, category, issue: messages.en[issueKey], issueKey, serial: "", status,
    received: dateFromToday(receivedOffset), target: dateFromToday(targetOffset), labour,
    parts: [{ id: partId, name: messages.en[partKey], nameKey: partKey, cost }], notes: messages.en[notesKey], notesKey,
    createdAt: new Date(now + receivedOffset * 86400000).toISOString(), updatedAt: new Date(now + Math.min(targetOffset, -1) * 3600000).toISOString(),
  }));
}

function loadRepairs() {
  const stored = readStorage(STORAGE_KEY);
  if (!stored) return sampleRepairs();
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map(normalizeRepair) : sampleRepairs();
  } catch { return sampleRepairs(); }
}

let repairs = loadRepairs();

function saveRepairs() {
  if (!writeStorage(STORAGE_KEY, JSON.stringify(repairs))) showToast(t("saveFailed"));
}

function saveSettings() {
  const payload = { language: currentLanguage, country: currentCountry, currency: currentCurrency, setupComplete: true, setupVersion: SETUP_VERSION, workshop: settings.workshop, search: settings.search };
  writeStorage(SETTINGS_KEY, JSON.stringify(payload));
}

function getIssue(repair) { return repair.issueKey ? t(repair.issueKey) : (repair.issue || t("noIssue")); }
function getNotes(repair) { return repair.notesKey ? t(repair.notesKey) : repair.notes; }
function getPartName(part) { return part.nameKey ? t(part.nameKey) : (part.name || t("partFallback")); }

function addHistory(repair, type, data = {}, at = new Date().toISOString()) {
  repair.history.push({ id: createId(), type, at, data });
}

function setMultilineText(element, value) {
  element.replaceChildren();
  String(value).split("\n").forEach((line, index) => {
    if (index) element.append(document.createElement("br"));
    element.append(document.createTextNode(line));
  });
}

function updateThemeLabel() {
  elements.themeLabel.textContent = t(document.documentElement.dataset.theme === "dark" ? "lightMode" : "darkMode");
}

function updateCurrencyUI() {
  document.querySelectorAll(".currency-symbol").forEach((element) => { element.textContent = currencySymbol(); });
  elements.currencyStatSymbol.textContent = currencySymbol();
  const step = String(currencyFractionDigits() ? 1 / 10 ** currencyFractionDigits() : 1);
  document.querySelectorAll('input[type="number"]').forEach((input) => {
    if (input.id !== "taxRateInput") input.step = step;
  });
  updateFormTotal();
}

function applyTranslations() {
  const language = languageByCode.get(currentLanguage) || languageByCode.get("en");
  document.documentElement.lang = language.locale;
  document.documentElement.dir = language.dir;
  document.title = t("pageTitleV012");
  document.querySelector('meta[name="description"]').content = t("pageDescriptionV012");
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (key === "heroTitle") setMultilineText(element, t(key)); else element.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => { element.placeholder = t(element.dataset.i18nPlaceholder); });
  document.querySelectorAll("[data-i18n-aria]").forEach((element) => { element.setAttribute("aria-label", t(element.dataset.i18nAria)); });
  refreshFormatters();
  updateThemeLabel();
  elements.preferencesLabel.textContent = `${language.nativeName} · ${countryName(currentCountry)} · ${currentCurrency}`;
  elements.dialogTitle.textContent = elements.repairId.value ? t("editRepair") : t("newRepair");
  elements.submitButtonLabel.textContent = elements.repairId.value ? t("updateRepair") : t("saveRepair");
  updateCurrencyUI();
  render();
}

function render() {
  renderStats();
  renderRepairCards();
  if (activeView === "history") renderHistory();
  if (activeView === "settings") updateRecommendedDomains();
}

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
    const searchable = [repair.device, t(repair.category), getIssue(repair), repair.serial, getNotes(repair), ...repair.parts.map(getPartName)].join(" ").toLocaleLowerCase(currentLocale());
    return (!query || searchable.includes(query)) && (status === "all" || repair.status === status);
  });
  return matches.sort((first, second) => {
    if (elements.sortSelect.value === "oldest") return new Date(first.createdAt) - new Date(second.createdAt);
    if (elements.sortSelect.value === "cost-high") return getRepairTotal(second) - getRepairTotal(first);
    if (elements.sortSelect.value === "cost-low") return getRepairTotal(first) - getRepairTotal(second);
    return new Date(second.createdAt) - new Date(first.createdAt);
  });
}

function cardButton(action, label, iconPath, className = "") {
  return `<button class="card-button ${className}" type="button" data-action="${action}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPath}" /></svg><span>${escapeHtml(label)}</span></button>`;
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
    const waitingOrders = repair.parts.filter((part) => part.order?.status === "waiting").length;
    const card = document.createElement("article");
    card.className = "repair-card";
    card.dataset.id = repair.id;
    card.dataset.status = repair.status;
    const partsLabel = repair.parts.length ? t("partsCount", { count: repair.parts.length }) : t("noParts");
    const dateLabel = repair.status === "completed" ? t("completedBy") : t("targetDate");
    const documentButtons = repair.status === "completed" ? `${cardButton("receipt", t("receipt"), "M7 3h10v18l-2-1.5L12 21l-3-1.5L7 21V3Zm3 5h4m-4 4h4m-4 4h3", "document-button")}${cardButton("invoice", t("invoice"), "M6 3h9l3 3v15H6V3Zm8 0v4h4M9 11h6m-6 4h6", "document-button")}` : "";
    card.innerHTML = `<div class="repair-card-top"><div><p class="device-type">${escapeHtml(t(repair.category))}</p><h3>${escapeHtml(repair.device)}</h3></div><span class="status-badge ${escapeHtml(repair.status)}">${escapeHtml(t(repair.status === "in-progress" ? "inProgress" : repair.status))}</span></div><p class="repair-issue">${escapeHtml(getIssue(repair))}</p>${waitingOrders ? `<p class="order-alert"><span></span>${escapeHtml(t("ordersWaiting", { count: waitingOrders }))}</p>` : ""}<div class="repair-meta"><div class="meta-item"><span>${escapeHtml(t("received"))}</span><strong>${escapeHtml(formatDate(repair.received))}</strong></div><div class="meta-item"><span>${escapeHtml(dateLabel)}</span><strong>${escapeHtml(formatDate(repair.target))}</strong></div></div><div class="repair-card-bottom"><div class="repair-cost"><span>${escapeHtml(partsLabel)}</span><strong>${escapeHtml(formatMoney(getRepairTotal(repair)))}</strong></div><div class="card-actions">${cardButton("history", t("history"), "M12 8v5l3 2M3.6 9A9 9 0 1 1 3 12M3 5v4h4", "history-button")}${documentButtons}${cardButton("edit", t("edit"), "m4 16-.8 4 4-.8L18 8.4 15.6 6 4 16Zm9.8-8.2 2.4 2.4", "edit-button")}${cardButton("delete", t("delete"), "M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5", "delete-button")}</div></div>`;
    elements.repairGrid.append(card);
  });
}

function resetFormErrors() {
  [elements.deviceInput, elements.issueInput].forEach((input) => input.closest(".field").classList.remove("has-error"));
  elements.deviceError.textContent = "";
  elements.issueError.textContent = "";
}

function resetCustomerFields() {
  elements.customerNameInput.value = "";
  elements.customerPhoneInput.value = "";
  elements.customerEmailInput.value = "";
  elements.customerAddressInput.value = "";
}

function openNewRepair() {
  elements.repairForm.reset();
  resetFormErrors();
  resetCustomerFields();
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
  elements.customerNameInput.value = repair.customer.name;
  elements.customerPhoneInput.value = repair.customer.phone;
  elements.customerEmailInput.value = repair.customer.email;
  elements.customerAddressInput.value = repair.customer.address;
  elements.partsList.replaceChildren();
  (repair.parts.length ? repair.parts : [{}]).forEach((part) => addPartRow({ ...part, name: getPartName(part) }));
  updateFormTotal();
  elements.repairDialog.showModal();
  requestAnimationFrame(() => elements.deviceInput.focus());
}

function closeRepairDialog() { elements.repairDialog.close(); }

function renderPartOrderSummary(row, order) {
  const summary = row.querySelector(".part-order-summary");
  if (!order) {
    summary.hidden = true;
    summary.replaceChildren();
    return;
  }
  const url = safeUrl(order.url);
  summary.hidden = false;
  summary.innerHTML = `<div><span class="order-status ${escapeHtml(order.status)}"><i></i>${escapeHtml(t(order.status === "received" ? "receivedPart" : "waitingDelivery"))}</span><strong>${escapeHtml(order.vendor || t("vendorUnknown"))}</strong>${order.title ? `<small>${escapeHtml(order.title)}</small>` : ""}</div><div class="inline-actions">${url ? `<a class="text-button" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("openOffer"))}</a>` : ""}${order.status === "waiting" ? `<button class="text-button" type="button" data-action="receive-part">${escapeHtml(t("markReceived"))}</button>` : ""}</div>`;
}

function localisePartRow(fragment) {
  const nameInput = fragment.querySelector(".part-name");
  const costInput = fragment.querySelector(".part-cost");
  nameInput.placeholder = t("partName");
  costInput.setAttribute("aria-label", t("partCost"));
  costInput.step = String(currencyFractionDigits() ? 1 / 10 ** currencyFractionDigits() : 1);
  fragment.querySelector(".remove-part").setAttribute("aria-label", t("removePart"));
  fragment.querySelector(".currency-symbol").textContent = currencySymbol();
  fragment.querySelector(".find-part-button span").textContent = t("findOffers");
}

function addPartRow(part = {}) {
  const fragment = elements.partRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".part-row");
  row.dataset.partId = part.id || createId();
  row.dataset.order = part.order ? JSON.stringify(part.order) : "";
  fragment.querySelector(".part-name").value = part.name || "";
  fragment.querySelector(".part-cost").value = toAmount(part.cost);
  localisePartRow(fragment);
  renderPartOrderSummary(row, part.order || null);
  elements.partsList.append(fragment);
}

function rowOrder(row) {
  if (!row.dataset.order) return null;
  try { return normalizeOrder(JSON.parse(row.dataset.order)); } catch { return null; }
}

function readParts() {
  return [...elements.partsList.querySelectorAll(".part-row")].map((row) => {
    const name = row.querySelector(".part-name").value.trim();
    const cost = toAmount(row.querySelector(".part-cost").value);
    return { id: row.dataset.partId || createId(), name: name || t("partFallback"), cost, order: rowOrder(row), isEmpty: !name && cost === 0 && !rowOrder(row) };
  }).filter((part) => !part.isEmpty).map(({ isEmpty, ...part }) => part);
}

function updateFormTotal() {
  if (!moneyFormatter || !elements.partsList) return;
  const partsTotal = [...elements.partsList.querySelectorAll(".part-cost")].reduce((sum, input) => sum + toAmount(input.value), 0);
  elements.formTotal.textContent = formatMoney(partsTotal + toAmount(elements.labourInput.value));
}

function validateRepairForm() {
  resetFormErrors();
  let valid = true;
  if (!elements.deviceInput.value.trim()) {
    elements.deviceInput.closest(".field").classList.add("has-error");
    elements.deviceError.textContent = t("validationDevice");
    valid = false;
  }
  if (!elements.issueInput.value.trim()) {
    elements.issueInput.closest(".field").classList.add("has-error");
    elements.issueError.textContent = t("validationIssue");
    valid = false;
  }
  if (!elements.receivedInput.value) valid = false;
  if (!valid) elements.repairForm.querySelector(".has-error input")?.focus();
  return valid;
}

function comparableRepairData(repair) {
  return JSON.stringify({
    device: repair.device, category: repair.category, issue: repair.issue, serial: repair.serial, received: repair.received,
    target: repair.target, labour: repair.labour, notes: repair.notes, customer: repair.customer,
  });
}

function recordRepairChanges(existing, repair) {
  if (!existing) {
    repair.history = [];
    addHistory(repair, "created", {}, repair.createdAt);
    repair.parts.forEach((part) => {
      addHistory(repair, "part-added", { part: part.name }, repair.createdAt);
      if (part.order?.status === "waiting") addHistory(repair, "part-ordered", { part: part.name, vendor: part.order.vendor, price: part.order.price, currency: part.order.currency }, part.order.orderedAt);
    });
    return;
  }
  repair.history = existing.history.map((event) => ({ ...event, data: { ...event.data } }));
  if (existing.status !== repair.status) addHistory(repair, "status", { from: existing.status, to: repair.status });
  if (comparableRepairData(existing) !== comparableRepairData(repair)) addHistory(repair, "updated");
  if (existing.notes !== repair.notes && repair.notes.trim()) addHistory(repair, "note", { note: repair.notes.trim() });
  const oldParts = new Map(existing.parts.map((part) => [part.id, part]));
  const newParts = new Map(repair.parts.map((part) => [part.id, part]));
  repair.parts.forEach((part) => {
    const old = oldParts.get(part.id);
    if (!old) addHistory(repair, "part-added", { part: part.name });
    if ((!old?.order || old.order.status !== "waiting") && part.order?.status === "waiting") {
      addHistory(repair, "part-ordered", { part: part.name, vendor: part.order.vendor, price: part.order.price, currency: part.order.currency }, part.order.orderedAt);
    }
    if (old?.order?.status === "waiting" && part.order?.status === "received") {
      addHistory(repair, "part-received", { part: part.name, vendor: part.order.vendor }, part.order.receivedAt);
    }
  });
  existing.parts.forEach((part) => {
    if (!newParts.has(part.id)) addHistory(repair, "part-removed", { part: getPartName(part) });
  });
}

function saveRepairFromForm(event) {
  event.preventDefault();
  if (!validateRepairForm()) return;
  const existingId = elements.repairId.value;
  const existing = repairs.find((repair) => repair.id === existingId);
  const now = new Date().toISOString();
  const parts = readParts();
  let status = elements.statusInput.value;
  if (parts.some((part) => part.order?.status === "waiting")) status = "waiting";
  else if (existing?.status === "waiting" && status === "waiting" && parts.some((part) => part.order?.status === "received")) status = "in-progress";
  const repair = normalizeRepair({
    id: existingId || createId(), device: elements.deviceInput.value.trim(), category: elements.categoryInput.value,
    status, issue: elements.issueInput.value.trim(), serial: elements.serialInput.value.trim(), received: elements.receivedInput.value,
    target: elements.targetInput.value, labour: elements.labourInput.value, parts, notes: elements.notesInput.value.trim(),
    customer: { name: elements.customerNameInput.value.trim(), phone: elements.customerPhoneInput.value.trim(), email: elements.customerEmailInput.value.trim(), address: elements.customerAddressInput.value.trim() },
    documents: existing?.documents || {}, history: existing?.history || [], createdAt: existing?.createdAt || now, updatedAt: now,
  });
  recordRepairChanges(existing, repair);
  repairs = existing ? repairs.map((item) => item.id === repair.id ? repair : item) : [repair, ...repairs];
  selectedHistoryId = repair.id;
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
  if (selectedHistoryId === pendingDeleteId) selectedHistoryId = repairs[0]?.id || null;
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
  toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 2800);
}

function showView(view, repairId = null) {
  if (!["overview", "history", "settings"].includes(view)) view = "overview";
  activeView = view;
  if (repairId) selectedHistoryId = repairId;
  document.querySelectorAll(".app-view").forEach((section) => {
    const active = section.dataset.view === view;
    section.hidden = !active;
    section.classList.toggle("active", active);
  });
  document.querySelectorAll("[data-view-target]").forEach((button) => button.classList.toggle("active", button.dataset.viewTarget === view));
  if (view === "history") renderHistory();
  if (view === "settings") populateSettingsForm();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function historyEventCopy(event) {
  const data = event.data || {};
  if (event.type === "created") return t("eventCreated");
  if (event.type === "updated") return t("eventUpdated");
  if (event.type === "status") return t("eventStatus", { from: t(data.from === "in-progress" ? "inProgress" : data.from), to: t(data.to === "in-progress" ? "inProgress" : data.to) });
  if (event.type === "part-added") return t("eventPartAdded", { part: data.part || t("partFallback") });
  if (event.type === "part-removed") return t("eventPartRemoved", { part: data.part || t("partFallback") });
  if (event.type === "part-ordered") return t("eventPartOrdered", { part: data.part || t("partFallback"), vendor: data.vendor || t("vendorUnknown") });
  if (event.type === "part-received") return t("eventPartReceived", { part: data.part || t("partFallback") });
  if (event.type === "note") return data.note || t("eventNote");
  if (event.type === "document") return t("eventDocument", { type: t(data.kind || "invoice"), number: data.number || "" });
  return t("eventUpdated");
}

function historyEventLabel(type) {
  return t({ created: "eventLabelCreated", updated: "eventLabelUpdated", status: "eventLabelStatus", "part-added": "eventLabelPart", "part-removed": "eventLabelPart", "part-ordered": "eventLabelOrder", "part-received": "eventLabelDelivery", note: "eventLabelNote", document: "eventLabelDocument" }[type] || "eventLabelUpdated");
}

function renderHistory() {
  const query = elements.historySearch.value.trim().toLocaleLowerCase(currentLocale());
  const visible = repairs.filter((repair) => [repair.device, getIssue(repair), repair.serial, ...repair.parts.map(getPartName)].join(" ").toLocaleLowerCase(currentLocale()).includes(query)).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  elements.historyRepairList.replaceChildren();
  visible.forEach((repair) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `history-repair${repair.id === selectedHistoryId ? " active" : ""}`;
    button.dataset.repairId = repair.id;
    button.innerHTML = `<span class="history-device-icon">${escapeHtml(repair.device.slice(0, 1).toUpperCase())}</span><span><strong>${escapeHtml(repair.device)}</strong><small>${escapeHtml(getIssue(repair))}</small><i>${escapeHtml(t("historyEventsCount", { count: repair.history.length }))}</i></span>`;
    elements.historyRepairList.append(button);
  });
  if (!selectedHistoryId || !repairs.some((repair) => repair.id === selectedHistoryId)) selectedHistoryId = visible[0]?.id || null;
  const selected = repairs.find((repair) => repair.id === selectedHistoryId);
  elements.timelineEmpty.hidden = Boolean(selected);
  elements.timelineContent.hidden = !selected;
  if (!selected) return;
  elements.timelineCategory.textContent = t(selected.category);
  elements.timelineDevice.textContent = selected.device;
  elements.timelineIssue.textContent = getIssue(selected);
  elements.editFromHistoryButton.dataset.repairId = selected.id;
  elements.timeline.replaceChildren();
  [...selected.history].sort((a, b) => new Date(b.at) - new Date(a.at)).forEach((event) => {
    const item = document.createElement("article");
    item.className = `timeline-event event-${event.type}`;
    const amount = event.type === "part-ordered" && toAmount(event.data?.price) ? formatMoneyFor(event.data.price, currentLanguage, event.data.currency || currentCurrency) : "";
    item.innerHTML = `<span class="timeline-dot" aria-hidden="true"></span><div class="timeline-event-card"><div><span>${escapeHtml(historyEventLabel(event.type))}</span><time datetime="${escapeHtml(event.at)}">${escapeHtml(formatDateTime(event.at))}</time></div><p>${escapeHtml(historyEventCopy(event))}</p>${amount ? `<strong>${escapeHtml(amount)}</strong>` : ""}</div>`;
    elements.timeline.append(item);
  });
}

function addTimelineNote(event) {
  event.preventDefault();
  const note = elements.timelineNoteInput.value.trim();
  const repair = repairs.find((item) => item.id === selectedHistoryId);
  if (!repair || !note) return;
  addHistory(repair, "note", { note });
  repair.updatedAt = new Date().toISOString();
  elements.timelineNoteInput.value = "";
  saveRepairs();
  renderHistory();
  showToast(t("noteAdded"));
}

function populateSelect(select, options, selected) {
  select.replaceChildren();
  options.forEach(({ value, label }) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  });
  select.value = selected;
}

function populateSettingsForm() {
  populateSelect(elements.settingsLanguage, languages.map((language) => ({ value: language.code, label: `${language.nativeName} — ${language.englishName}` })), currentLanguage);
  populateSelect(elements.settingsCountry, countries.map((country) => ({ value: country.code, label: `${flagEmoji(country.code)} ${countryName(country.code)}` })), currentCountry);
  populateSelect(elements.settingsCurrency, currencies.map((code) => ({ value: code, label: `${code} — ${currencyName(code)}` })), currentCurrency);
  const workshop = settings.workshop;
  elements.workshopNameInput.value = workshop.name;
  elements.workshopAddressInput.value = workshop.address;
  elements.workshopCityInput.value = workshop.city;
  elements.workshopPostcodeInput.value = workshop.postcode;
  elements.workshopPhoneInput.value = workshop.phone;
  elements.workshopEmailInput.value = workshop.email;
  elements.workshopTaxIdInput.value = workshop.taxId;
  elements.invoicePrefixInput.value = workshop.invoicePrefix || "RD";
  elements.taxRateInput.value = toAmount(workshop.taxRate);
  elements.paymentDetailsInput.value = workshop.paymentDetails;
  elements.searchEngineIdInput.value = settings.search.engineId;
  updateRecommendedDomains();
}

function updateRecommendedDomains() {
  const code = countryCodes.has(elements.settingsCountry.value) ? elements.settingsCountry.value : currentCountry;
  elements.domainCountryLabel.textContent = countryName(code, elements.settingsLanguage.value || currentLanguage);
  elements.recommendedDomains.textContent = recommendedDomains(code).map((domain) => `${domain}/*`).join("\n");
}

function saveSettingsForm(event) {
  event.preventDefault();
  currentLanguage = languageByCode.has(elements.settingsLanguage.value) ? elements.settingsLanguage.value : currentLanguage;
  currentCountry = countryCodes.has(elements.settingsCountry.value) ? elements.settingsCountry.value : currentCountry;
  currentCurrency = currencies.includes(elements.settingsCurrency.value) ? elements.settingsCurrency.value : currentCurrency;
  settings.workshop = {
    name: elements.workshopNameInput.value.trim(), address: elements.workshopAddressInput.value.trim(), city: elements.workshopCityInput.value.trim(),
    postcode: elements.workshopPostcodeInput.value.trim(), phone: elements.workshopPhoneInput.value.trim(), email: elements.workshopEmailInput.value.trim(),
    taxId: elements.workshopTaxIdInput.value.trim(), invoicePrefix: elements.invoicePrefixInput.value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12) || "RD",
    taxRate: Math.min(100, toAmount(elements.taxRateInput.value)), paymentDetails: elements.paymentDetailsInput.value.trim(),
  };
  settings.search.engineId = elements.searchEngineIdInput.value.trim();
  saveSettings();
  applyTranslations();
  populateSettingsForm();
  showToast(t("settingsSaved"));
}

async function copyRecommendedDomains() {
  const value = elements.recommendedDomains.textContent;
  try {
    await navigator.clipboard.writeText(value);
    showToast(t("domainsCopied"));
  } catch {
    const range = document.createRange();
    range.selectNodeContents(elements.recommendedDomains);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    showToast(t("copyManually"));
  }
}

function finderPartName() {
  return finderRow?.querySelector(".part-name")?.value.trim() || t("partFallback");
}

function finderDeviceName() {
  return elements.deviceInput.value.trim();
}

function finderQuery() {
  return `${finderDeviceName()} ${finderPartName()}`.trim();
}

function renderProviderLinks(query) {
  elements.providerLinks.replaceChildren();
  const links = providerList(currentCountry).map((provider) => ({ name: provider.name, url: buildUrl(provider.url, query), domain: provider.domain }));
  links.push({ name: "Google Shopping", url: shoppingUrl(query, currentCountry, currentLanguage), domain: "google.com" });
  links.forEach((provider) => {
    const anchor = document.createElement("a");
    anchor.className = "provider-link";
    anchor.href = provider.url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.innerHTML = `<span>${escapeHtml(provider.name.slice(0, 2).toUpperCase())}</span><strong>${escapeHtml(provider.name)}</strong><small>${escapeHtml(provider.domain)}</small><i aria-hidden="true">↗</i>`;
    elements.providerLinks.append(anchor);
  });
}

function setFinderStatus(kind, message, action = "") {
  elements.finderStatus.className = `finder-status ${kind}`;
  elements.finderStatus.innerHTML = `<span aria-hidden="true">${kind === "loading" ? "…" : kind === "success" ? "✓" : "↳"}</span><p>${escapeHtml(message)}</p>${action ? `<button class="text-button" type="button" data-finder-action="${escapeHtml(action)}">${escapeHtml(t(action === "settings" ? "openSettings" : "addManualOffer"))}</button>` : ""}`;
}

function openFinder(row) {
  const partName = row.querySelector(".part-name").value.trim();
  const device = elements.deviceInput.value.trim();
  if (!device) {
    elements.deviceInput.focus();
    showToast(t("enterDeviceFirst"));
    return;
  }
  if (!partName) {
    row.querySelector(".part-name").focus();
    showToast(t("enterPartFirst"));
    return;
  }
  finderRow = row;
  currentOffers = [];
  const query = `${device} ${partName}`;
  elements.finderTitle.textContent = partName;
  elements.finderContext.textContent = device;
  elements.finderQueryInput.value = query;
  elements.finderCountryLabel.textContent = `${flagEmoji(currentCountry)} ${countryName(currentCountry)}`;
  renderProviderLinks(query);
  elements.offerGrid.replaceChildren();
  elements.pricePanel.hidden = true;
  if (settings.search.engineId) setFinderStatus("info", t("searchReady"), "manual");
  else setFinderStatus("info", t("searchNotConfigured"), "settings");
  elements.finderDialog.showModal();
  requestAnimationFrame(() => elements.finderQueryInput.focus());
}

function closeFinder() {
  elements.finderDialog.close();
  currentOffers = [];
  finderRow = null;
}

function objectEntriesDeep(value, path = [], output = []) {
  if (!value || typeof value !== "object") return output;
  Object.entries(value).forEach(([key, child]) => {
    const nextPath = [...path, key];
    if (child && typeof child === "object") objectEntriesDeep(child, nextPath, output);
    else output.push({ key: key.toLowerCase(), path: nextPath.join(".").toLowerCase(), value: String(child ?? "") });
  });
  return output;
}

function parsePriceNumber(value) {
  const match = String(value).replace(/[\u00a0\s']/g, "").match(/\d[\d.,]*/);
  if (!match) return null;
  let number = match[0];
  const dot = number.lastIndexOf(".");
  const comma = number.lastIndexOf(",");
  if (dot >= 0 && comma >= 0) {
    const decimal = dot > comma ? "." : ",";
    number = number.replace(decimal === "." ? /,/g : /\./g, "").replace(decimal, ".");
  } else if (comma >= 0) {
    const decimals = number.length - comma - 1;
    number = decimals > 0 && decimals <= 2 ? number.replace(",", ".") : number.replace(/,/g, "");
  } else if (dot >= 0) {
    const decimals = number.length - dot - 1;
    if (decimals === 3 && number.indexOf(".") === dot) number = number.replace(".", "");
  }
  const parsed = Number.parseFloat(number);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const currencyTokens = {
  USD: ["USD", "US$", "$"], EUR: ["EUR", "€"], GBP: ["GBP", "£"], JPY: ["JPY", "¥", "￥"],
  CNY: ["CNY", "RMB", "CN¥"], RUB: ["RUB", "₽"], UAH: ["UAH", "₴"], INR: ["INR", "₹"],
  KRW: ["KRW", "₩"], TRY: ["TRY", "₺"], PLN: ["PLN", "zł"], SAR: ["SAR", "ر.س"],
  BDT: ["BDT", "৳"], IDR: ["IDR", "Rp"], VND: ["VND", "₫"], THB: ["THB", "฿"],
};

function currencyFromText(value) {
  const text = String(value).toUpperCase();
  for (const [code, tokens] of Object.entries(currencyTokens)) {
    if (tokens.some((token) => text.includes(token.toUpperCase()))) return code;
  }
  return "";
}

function extractResultPrice(result) {
  const entries = objectEntriesDeep(result.richSnippet || {});
  const currencyEntry = entries.find((entry) => /pricecurrency|currency/.test(entry.path));
  let currency = currencyFromText(currencyEntry?.value || "");
  const priceEntry = entries.find((entry) => /(^|\.)(price|lowprice|saleprice|offerprice)$/.test(entry.path));
  let price = parsePriceNumber(priceEntry?.value || "");
  const combined = [result.contentNoFormatting, result.titleNoFormatting, ...entries.map((entry) => entry.value)].filter(Boolean).join(" ");
  if (!currency) currency = currencyFromText(combined);
  if (!price && currency) {
    const tokens = currencyTokens[currency] || [currency];
    for (const token of tokens) {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const before = combined.match(new RegExp(`${escaped}\\s*([0-9][0-9.,\\s']*)`, "i"));
      const after = combined.match(new RegExp(`([0-9][0-9.,\\s']*)\\s*${escaped}`, "i"));
      price = parsePriceNumber(before?.[1] || after?.[1] || "");
      if (price) break;
    }
  }
  return { price, currency, verified: Boolean(price && currency) };
}

function extractOffer(result, index) {
  const priceData = extractResultPrice(result);
  const richEntries = objectEntriesDeep(result.richSnippet || {});
  const imageEntry = richEntries.find((entry) => /(^|\.)(image|imageurl|thumbnailurl)$/.test(entry.path) && safeUrl(entry.value));
  return {
    id: `google-${index}-${Date.now()}`,
    title: String(result.titleNoFormatting || result.title || t("partFallback")).replace(/<[^>]+>/g, "").slice(0, 220),
    vendor: String(result.visibleUrl || "").replace(/^www\./, "").split("/")[0].slice(0, 100),
    url: safeUrl(result.url),
    image: safeUrl(result.thumbnailImage?.url || imageEntry?.value || ""),
    price: priceData.price,
    currency: priceData.currency,
    verified: priceData.verified,
    manual: false,
  };
}

function googleResultsReady(name, query, promotions, results, resultsDiv) {
  if (name !== "repairdesk-parts") return false;
  resultsDiv.replaceChildren();
  currentOffers = Array.isArray(results) ? results.map(extractOffer).filter((offer) => offer.url) : [];
  renderOffers();
  setFinderStatus(currentOffers.length ? "success" : "info", currentOffers.length ? t("searchResultsCount", { count: currentOffers.length }) : t("searchNoResults"), "manual");
  return true;
}

function loadGoogleSearch(engineId) {
  const id = String(engineId || "").trim();
  if (!id) return Promise.reject(new Error("missing-engine"));
  if (googleSearchPromise) {
    if (googleSearchEngineId === id) return googleSearchPromise;
    return Promise.reject(new Error("engine-changed"));
  }
  googleSearchEngineId = id;
  googleSearchPromise = new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };
    window.__gcse = {
      parsetags: "explicit",
      initializationCallback: () => {
        try {
          google.search.cse.element.render({ div: "googleResultsHost", tag: "searchresults-only", gname: "repairdesk-parts", attributes: { resultSetSize: 10, linkTarget: "_blank", safeSearch: "active", autoSearchOnLoad: false } });
          finish(resolve);
        } catch (error) { finish(reject, error); }
      },
      searchCallbacks: { web: { ready: googleResultsReady } },
    };
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://cse.google.com/cse.js?cx=${encodeURIComponent(id)}`;
    script.onerror = () => finish(reject, new Error("search-script"));
    document.head.append(script);
    setTimeout(() => finish(reject, new Error("search-timeout")), 15000);
  }).catch((error) => {
    googleSearchPromise = null;
    googleSearchEngineId = "";
    throw error;
  });
  return googleSearchPromise;
}

async function runPartsSearch(event) {
  event.preventDefault();
  const query = elements.finderQueryInput.value.trim();
  if (!query) return;
  renderProviderLinks(query);
  elements.offerGrid.replaceChildren();
  elements.pricePanel.hidden = true;
  currentOffers = [];
  if (!settings.search.engineId) {
    setFinderStatus("info", t("searchNotConfigured"), "settings");
    return;
  }
  setFinderStatus("loading", t("searchLoading"));
  try {
    await loadGoogleSearch(settings.search.engineId);
    const searchElement = google.search.cse.element.getElement("repairdesk-parts");
    if (!searchElement) throw new Error("search-element");
    searchElement.execute(`${query} ${t("searchQuerySuffix")}`.trim());
  } catch (error) {
    const message = error.message === "engine-changed" ? t("searchReloadRequired") : t("searchError");
    setFinderStatus("error", message, "manual");
  }
}

function addManualOffer() {
  currentOffers.push({ id: createId(), title: finderPartName(), vendor: "", url: "", image: "", price: null, currency: currentCurrency, verified: true, manual: true });
  renderOffers();
  setFinderStatus("info", t("manualOfferCopy"));
}

function offerImage(offer) {
  return offer.image ? `<img src="${escapeHtml(offer.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : `<span class="offer-image-placeholder" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4V5Zm0 10 4-4 4 4 3-3 5 5M15 9h.01" /></svg></span>`;
}

function renderOffers() {
  elements.offerGrid.replaceChildren();
  currentOffers.forEach((offer, index) => {
    const card = document.createElement("article");
    card.className = `offer-card${offer.manual ? " manual" : ""}`;
    card.dataset.offerIndex = index;
    const matchingCurrency = !offer.currency || offer.currency === currentCurrency;
    const priceValue = offer.price && matchingCurrency ? offer.price : "";
    const sourcePrice = offer.price && !matchingCurrency ? formatMoneyFor(offer.price, currentLanguage, offer.currency) : "";
    const editableMeta = offer.manual ? `<label><span>${escapeHtml(t("vendor"))}</span><input data-offer-field="vendor" value="${escapeHtml(offer.vendor)}" maxlength="100" /></label><label><span>${escapeHtml(t("offerUrl"))}</span><input data-offer-field="url" type="url" value="${escapeHtml(offer.url)}" placeholder="https://" /></label>` : `<p class="offer-domain">${escapeHtml(offer.vendor)}</p>`;
    card.innerHTML = `<div class="offer-image">${offerImage(offer)}</div><div class="offer-content"><div>${editableMeta}<h4>${escapeHtml(offer.title)}</h4></div><div class="offer-price-editor"><label><span>${escapeHtml(t(priceValue ? "recognisedPrice" : "enterOfferPrice"))}${sourcePrice ? ` · ${escapeHtml(sourcePrice)}` : ""}</span><span class="money-input compact"><span>${escapeHtml(currencySymbol())}</span><input data-offer-field="price" type="number" min="0" step="any" value="${escapeHtml(priceValue)}" /></span></label></div><div class="offer-actions">${offer.url ? `<a class="secondary-button" href="${escapeHtml(offer.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("openOffer"))}</a>` : ""}<button class="primary-button" type="button" data-offer-action="order">${escapeHtml(t("markOrdered"))}</button></div></div>`;
    const image = card.querySelector("img");
    if (image) image.addEventListener("error", () => { image.replaceWith(document.createRange().createContextualFragment(offerImage({ image: "" }))); }, { once: true });
    elements.offerGrid.append(card);
  });
  renderPriceChart();
}

function comparableOffers() {
  return currentOffers.map((offer, index) => ({ ...offer, index })).filter((offer) => offer.price && (!offer.currency || offer.currency === currentCurrency)).sort((a, b) => a.price - b.price).slice(0, 10);
}

function median(values) {
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

function renderPriceChart() {
  const offers = comparableOffers();
  elements.pricePanel.hidden = offers.length === 0;
  elements.priceChart.replaceChildren();
  elements.priceSummary.replaceChildren();
  if (!offers.length) return;
  const width = 760;
  const labelWidth = 150;
  const plotWidth = width - labelWidth - 110;
  const rowHeight = 46;
  const height = offers.length * rowHeight + 26;
  const max = Math.max(...offers.map((offer) => offer.price));
  const rows = offers.map((offer, position) => {
    const y = position * rowHeight + 12;
    const barWidth = Math.max(4, (offer.price / max) * plotWidth);
    const label = (offer.vendor || t("manualOffer")).slice(0, 19);
    return `<g><text x="0" y="${y + 17}" class="chart-label">${escapeHtml(label)}</text><rect x="${labelWidth}" y="${y}" width="${barWidth}" height="24" rx="7" class="chart-bar${position === 0 ? " best" : ""}" /><text x="${Math.min(labelWidth + barWidth + 10, width - 100)}" y="${y + 17}" class="chart-value">${escapeHtml(formatMoney(offer.price))}</text></g>`;
  }).join("");
  elements.priceChart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(t("priceComparison"))}">${rows}</svg>`;
  const values = offers.map((offer) => offer.price);
  const summary = [["lowestPrice", values[0]], ["medianPrice", median(values)], ["highestPrice", values.at(-1)]];
  summary.forEach(([key, value]) => {
    const item = document.createElement("div");
    item.innerHTML = `<span>${escapeHtml(t(key))}</span><strong>${escapeHtml(formatMoney(value))}</strong>`;
    elements.priceSummary.append(item);
  });
}

function markOfferOrdered(index) {
  const offer = currentOffers[index];
  if (!offer || !finderRow) return;
  const card = elements.offerGrid.querySelector(`[data-offer-index="${index}"]`);
  const price = toAmount(card?.querySelector('[data-offer-field="price"]')?.value || offer.price);
  const vendor = card?.querySelector('[data-offer-field="vendor"]')?.value.trim() || offer.vendor || t("vendorUnknown");
  const url = safeUrl(card?.querySelector('[data-offer-field="url"]')?.value || offer.url);
  const order = { status: "waiting", vendor, title: offer.title, url, image: offer.image, price, currency: currentCurrency, orderedAt: new Date().toISOString(), receivedAt: "" };
  finderRow.dataset.order = JSON.stringify(order);
  if (price) finderRow.querySelector(".part-cost").value = price;
  renderPartOrderSummary(finderRow, order);
  updateFormTotal();
  elements.finderDialog.close();
  currentOffers = [];
  finderRow = null;
  showToast(t("offerSelectedSave"));
}

function markRowReceived(row) {
  const order = rowOrder(row);
  if (!order || order.status !== "waiting") return;
  order.status = "received";
  order.receivedAt = new Date().toISOString();
  row.dataset.order = JSON.stringify(order);
  renderPartOrderSummary(row, order);
  showToast(t("partReceivedSave"));
}

async function testSearchConnection() {
  const engineId = elements.searchEngineIdInput.value.trim();
  if (!engineId) {
    showToast(t("enterSearchEngineId"));
    elements.searchEngineIdInput.focus();
    return;
  }
  elements.testSearchButton.disabled = true;
  elements.testSearchButton.textContent = t("searchLoading");
  try {
    await loadGoogleSearch(engineId);
    showToast(t("searchConnectionReady"));
  } catch {
    showToast(t("searchConnectionFailed"));
  } finally {
    elements.testSearchButton.disabled = false;
    elements.testSearchButton.textContent = t("testSearch");
  }
}

function nextDocumentNumber(kind) {
  const prefix = settings.workshop.invoicePrefix || "RD";
  const year = new Date().getFullYear();
  const code = kind === "receipt" ? "REC" : "INV";
  const expression = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-${code}-${year}-(\\d+)$`);
  const sequence = repairs.flatMap((repair) => Object.values(repair.documents || {})).map((document) => String(document?.number || "").match(expression)).filter(Boolean).reduce((max, match) => Math.max(max, Number(match[1])), 0) + 1;
  return `${prefix}-${code}-${year}-${String(sequence).padStart(4, "0")}`;
}

function documentContactLines() {
  const workshop = settings.workshop;
  return [workshop.address, [workshop.postcode, workshop.city].filter(Boolean).join(" "), countryName(currentCountry), workshop.phone, workshop.email, workshop.taxId ? `${t("taxId")}: ${workshop.taxId}` : ""].filter(Boolean);
}

function ensureDocument(repair, kind) {
  if (repair.documents[kind]?.number) return repair.documents[kind];
  const document = { number: nextDocumentNumber(kind), createdAt: new Date().toISOString() };
  repair.documents[kind] = document;
  addHistory(repair, "document", { kind, number: document.number }, document.createdAt);
  repair.updatedAt = document.createdAt;
  saveRepairs();
  return document;
}

function documentItemRows(repair) {
  const partRows = repair.parts.map((part) => `<tr><td><strong>${escapeHtml(getPartName(part))}</strong>${part.order?.vendor ? `<small>${escapeHtml(part.order.vendor)}</small>` : ""}</td><td>1</td><td>${escapeHtml(formatMoney(part.cost))}</td><td>${escapeHtml(formatMoney(part.cost))}</td></tr>`).join("");
  const labourRow = repair.labour ? `<tr><td><strong>${escapeHtml(t("labour"))}</strong><small>${escapeHtml(repair.device)}</small></td><td>1</td><td>${escapeHtml(formatMoney(repair.labour))}</td><td>${escapeHtml(formatMoney(repair.labour))}</td></tr>` : "";
  return partRows + labourRow || `<tr><td><strong>${escapeHtml(t("repairService"))}</strong><small>${escapeHtml(repair.device)}</small></td><td>1</td><td>${escapeHtml(formatMoney(0))}</td><td>${escapeHtml(formatMoney(0))}</td></tr>`;
}

function renderDocument(repair, kind, document) {
  const workshop = settings.workshop;
  const workshopName = workshop.name || t("defaultWorkshopName");
  const customer = repair.customer;
  const subtotal = getRepairTotal(repair);
  const taxRate = toAmount(workshop.taxRate);
  const tax = subtotal * taxRate / 100;
  const total = subtotal + tax;
  const customerLines = [customer.name || t("noCustomer"), customer.address, customer.phone, customer.email].filter(Boolean);
  const contactLines = documentContactLines();
  elements.documentDialogTitle.textContent = t(kind);
  elements.documentSheet.innerHTML = `<header class="doc-header"><div><span class="doc-brand-mark">↳</span><strong>${escapeHtml(workshopName)}</strong><p>${contactLines.map(escapeHtml).join("<br>")}</p></div><div class="doc-title"><span>${escapeHtml(t("repairDocument"))}</span><h1>${escapeHtml(t(kind))}</h1><p>${escapeHtml(document.number)}</p></div></header><section class="doc-meta"><div><span>${escapeHtml(t("documentNumber"))}</span><strong>${escapeHtml(document.number)}</strong></div><div><span>${escapeHtml(t("issueDate"))}</span><strong>${escapeHtml(formatDate(document.createdAt.slice(0, 10)))}</strong></div><div><span>${escapeHtml(t("repairStatus"))}</span><strong>${escapeHtml(t(repair.status === "in-progress" ? "inProgress" : repair.status))}</strong></div></section><section class="doc-parties"><div><span>${escapeHtml(t("workshop"))}</span><strong>${escapeHtml(workshopName)}</strong><p>${contactLines.map(escapeHtml).join("<br>")}</p></div><div><span>${escapeHtml(t("billTo"))}</span><strong>${escapeHtml(customerLines[0])}</strong><p>${customerLines.slice(1).map(escapeHtml).join("<br>")}</p></div></section><section class="doc-repair"><div><span>${escapeHtml(t("deviceModel"))}</span><strong>${escapeHtml(repair.device)}</strong></div><div><span>${escapeHtml(t("serial"))}</span><strong>${escapeHtml(repair.serial || t("notSet"))}</strong></div><div><span>${escapeHtml(t("issue"))}</span><strong>${escapeHtml(getIssue(repair))}</strong></div></section><table class="doc-table"><thead><tr><th>${escapeHtml(t("description"))}</th><th>${escapeHtml(t("quantity"))}</th><th>${escapeHtml(t("unitPrice"))}</th><th>${escapeHtml(t("amount"))}</th></tr></thead><tbody>${documentItemRows(repair)}</tbody></table><section class="doc-totals"><div><span>${escapeHtml(t("subtotal"))}</span><strong>${escapeHtml(formatMoney(subtotal))}</strong></div><div><span>${escapeHtml(t("taxWithRate", { rate: taxRate }))}</span><strong>${escapeHtml(formatMoney(tax))}</strong></div><div class="doc-grand-total"><span>${escapeHtml(t("total"))}</span><strong>${escapeHtml(formatMoney(total))}</strong></div></section>${getNotes(repair) ? `<section class="doc-notes"><span>${escapeHtml(t("notes"))}</span><p>${escapeHtml(getNotes(repair))}</p></section>` : ""}${kind === "invoice" && workshop.paymentDetails ? `<section class="doc-payment"><span>${escapeHtml(t("paymentDetails"))}</span><p>${escapeHtml(workshop.paymentDetails)}</p></section>` : ""}<footer class="doc-footer"><p>${escapeHtml(t(kind === "receipt" ? "receiptFooter" : "invoiceFooter"))}</p><span>RepairDesk · Pikaneth (Sviatoslav)</span></footer>`;
}

function openDocument(repairId, kind) {
  const repair = repairs.find((item) => item.id === repairId);
  if (!repair || !["receipt", "invoice"].includes(kind)) return;
  if (repair.status !== "completed") {
    showToast(t("completeToCreateDocuments"));
    return;
  }
  const document = ensureDocument(repair, kind);
  renderDocument(repair, kind, document);
  render();
  elements.documentDialog.showModal();
}

function printDocument() {
  document.body.classList.add("printing-document");
  window.print();
}

function setTheme(theme) {
  const dark = theme === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]').content = dark ? "#111714" : "#f4f2ed";
  writeStorage(THEME_KEY, dark ? "dark" : "light");
  updateThemeLabel();
}

function initialiseTheme() {
  const savedTheme = readStorage(THEME_KEY);
  const systemTheme = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  setTheme(savedTheme || systemTheme);
}

function toggleTheme() {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
}

function renderLanguageGrid() {
  elements.languageGrid.replaceChildren();
  languages.forEach((language) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `language-option${language.code === pendingLanguage ? " selected" : ""}`;
    button.dataset.language = language.code;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(language.code === pendingLanguage));
    button.innerHTML = `<strong>${escapeHtml(language.nativeName)}</strong><span>${escapeHtml(language.englishName)}</span><i aria-hidden="true">${escapeHtml(language.code.toUpperCase())}</i>`;
    elements.languageGrid.append(button);
  });
}

function renderCountryGrid() {
  elements.countryGrid.replaceChildren();
  countries.forEach((country) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `country-option${country.code === pendingCountry ? " selected" : ""}`;
    button.dataset.country = country.code;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(country.code === pendingCountry));
    button.innerHTML = `<span aria-hidden="true">${flagEmoji(country.code)}</span><strong>${escapeHtml(countryName(country.code, pendingLanguage))}</strong><i>${escapeHtml(country.code)}</i>`;
    elements.countryGrid.append(button);
  });
}

function populateCurrencyOptions() {
  const selected = currencies.includes(pendingCurrency) ? pendingCurrency : detectCurrency(pendingCountry);
  populateSelect(elements.currencySelect, currencies.map((code) => ({ value: code, label: `${code} — ${currencyName(code, pendingLanguage)}` })), selected);
  pendingCurrency = elements.currencySelect.value || "USD";
  updateCurrencyPreview();
}

function updateCurrencyPreview() {
  elements.currencyPreview.textContent = formatMoneyFor(1234.56, pendingLanguage, pendingCurrency);
}

function showSetupStep(step) {
  const steps = ["language", "country", "currency"];
  const index = Math.max(0, steps.indexOf(step));
  elements.languageStep.hidden = index !== 0;
  elements.countryStep.hidden = index !== 1;
  elements.currencyStep.hidden = index !== 2;
  elements.setupProgress.forEach((item, position) => item.classList.toggle("active", position <= index));
  elements.setupDialog.setAttribute("aria-labelledby", ["setupTitle", "countrySetupTitle", "currencySetupTitle"][index]);
  if (index === 1) {
    renderCountryGrid();
    requestAnimationFrame(() => elements.countryGrid.querySelector(".selected")?.focus());
  }
  if (index === 2) {
    populateCurrencyOptions();
    requestAnimationFrame(() => elements.currencySelect.focus());
  }
}

function openSetup(step = "language") {
  pendingLanguage = currentLanguage;
  pendingCountry = currentCountry;
  pendingCurrency = currentCurrency;
  renderLanguageGrid();
  showSetupStep(step);
  if (!elements.setupDialog.open) elements.setupDialog.showModal();
}

function selectLanguage(language) {
  if (!languageByCode.has(language)) return;
  pendingLanguage = language;
  currentLanguage = language;
  if (!countryCodes.has(pendingCountry)) pendingCountry = defaultCountryByLanguage[language] || "US";
  applyTranslations();
  renderLanguageGrid();
}

function selectCountry(country) {
  if (!countryCodes.has(country)) return;
  pendingCountry = country;
  pendingCurrency = detectCurrency(country);
  renderCountryGrid();
}

function finishSetup() {
  currentLanguage = pendingLanguage;
  currentCountry = countryCodes.has(pendingCountry) ? pendingCountry : detectCountry(currentLanguage);
  currentCurrency = currencies.includes(pendingCurrency) ? pendingCurrency : detectCurrency(currentCountry);
  settings.language = currentLanguage;
  settings.country = currentCountry;
  settings.currency = currentCurrency;
  settings.setupComplete = true;
  settings.setupVersion = SETUP_VERSION;
  saveSettings();
  applyTranslations();
  elements.setupDialog.close();
}

function closeDialogFromBackdrop(event) {
  const dialog = event.currentTarget;
  const bounds = dialog.getBoundingClientRect();
  const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
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
elements.searchInput.addEventListener("input", renderRepairCards);
elements.statusFilter.addEventListener("change", renderRepairCards);
elements.sortSelect.addEventListener("change", renderRepairCards);
elements.cancelDeleteButton.addEventListener("click", closeDeleteDialog);
elements.confirmDeleteButton.addEventListener("click", deletePendingRepair);
elements.repairDialog.addEventListener("click", closeDialogFromBackdrop);
elements.confirmDialog.addEventListener("click", closeDialogFromBackdrop);
elements.closeFinderButton.addEventListener("click", closeFinder);
elements.finderSearchForm.addEventListener("submit", runPartsSearch);
elements.closeDocumentButton.addEventListener("click", () => elements.documentDialog.close());
elements.printDocumentButton.addEventListener("click", printDocument);
elements.historySearch.addEventListener("input", renderHistory);
elements.timelineNoteForm.addEventListener("submit", addTimelineNote);
elements.settingsForm.addEventListener("submit", saveSettingsForm);
elements.settingsCountry.addEventListener("change", updateRecommendedDomains);
elements.settingsLanguage.addEventListener("change", () => {
  const language = elements.settingsLanguage.value;
  populateSelect(elements.settingsCountry, countries.map((country) => ({ value: country.code, label: `${flagEmoji(country.code)} ${countryName(country.code, language)}` })), elements.settingsCountry.value || currentCountry);
  populateSelect(elements.settingsCurrency, currencies.map((code) => ({ value: code, label: `${code} — ${currencyName(code, language)}` })), elements.settingsCurrency.value || currentCurrency);
  updateRecommendedDomains();
});
elements.copyDomainsButton.addEventListener("click", copyRecommendedDomains);
elements.testSearchButton.addEventListener("click", testSearchConnection);

elements.receivedInput.addEventListener("change", () => {
  elements.targetInput.min = elements.receivedInput.value;
  if (elements.targetInput.value && elements.targetInput.value < elements.receivedInput.value) elements.targetInput.value = elements.receivedInput.value;
});

elements.partsList.addEventListener("click", (event) => {
  const row = event.target.closest(".part-row");
  if (!row) return;
  if (event.target.closest(".remove-part")) {
    row.remove();
    if (!elements.partsList.children.length) addPartRow();
    updateFormTotal();
  } else if (event.target.closest('[data-action="find-part"]')) openFinder(row);
  else if (event.target.closest('[data-action="receive-part"]')) markRowReceived(row);
});

elements.partsList.addEventListener("input", updateFormTotal);
elements.labourInput.addEventListener("input", updateFormTotal);

elements.repairGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  const card = button?.closest(".repair-card");
  if (!button || !card) return;
  if (button.dataset.action === "edit") openEditRepair(card.dataset.id);
  else if (button.dataset.action === "delete") requestDelete(card.dataset.id);
  else if (button.dataset.action === "history") showView("history", card.dataset.id);
  else if (["receipt", "invoice"].includes(button.dataset.action)) openDocument(card.dataset.id, button.dataset.action);
});

elements.historyRepairList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-repair-id]");
  if (!button) return;
  selectedHistoryId = button.dataset.repairId;
  renderHistory();
});

elements.editFromHistoryButton.addEventListener("click", () => openEditRepair(elements.editFromHistoryButton.dataset.repairId));

elements.finderStatus.addEventListener("click", (event) => {
  const action = event.target.closest("[data-finder-action]")?.dataset.finderAction;
  if (action === "settings") {
    elements.finderDialog.close();
    showView("settings");
  } else if (action === "manual") addManualOffer();
});

elements.offerGrid.addEventListener("input", (event) => {
  const card = event.target.closest("[data-offer-index]");
  if (!card) return;
  const offer = currentOffers[Number(card.dataset.offerIndex)];
  if (!offer) return;
  if (event.target.dataset.offerField === "price") {
    offer.price = toAmount(event.target.value) || null;
    offer.currency = currentCurrency;
    renderPriceChart();
  } else if (event.target.dataset.offerField === "vendor") offer.vendor = event.target.value;
  else if (event.target.dataset.offerField === "url") offer.url = event.target.value;
});

elements.offerGrid.addEventListener("click", (event) => {
  const button = event.target.closest('[data-offer-action="order"]');
  const card = button?.closest("[data-offer-index]");
  if (button && card) markOfferOrdered(Number(card.dataset.offerIndex));
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-view-target]");
  if (target) showView(target.dataset.viewTarget);
});

elements.languageGrid.addEventListener("click", (event) => {
  const option = event.target.closest("[data-language]");
  if (option) selectLanguage(option.dataset.language);
});
elements.countryGrid.addEventListener("click", (event) => {
  const option = event.target.closest("[data-country]");
  if (option) selectCountry(option.dataset.country);
});
elements.languageContinueButton.addEventListener("click", () => showSetupStep("country"));
elements.countryBackButton.addEventListener("click", () => showSetupStep("language"));
elements.countryContinueButton.addEventListener("click", () => showSetupStep("currency"));
elements.currencyBackButton.addEventListener("click", () => showSetupStep("country"));
elements.currencySelect.addEventListener("change", () => { pendingCurrency = elements.currencySelect.value; updateCurrencyPreview(); });
elements.finishSetupButton.addEventListener("click", finishSetup);

elements.repairDialog.addEventListener("close", resetFormErrors);
elements.confirmDialog.addEventListener("close", () => { pendingDeleteId = null; });
elements.documentDialog.addEventListener("click", closeDialogFromBackdrop);
window.addEventListener("afterprint", () => document.body.classList.remove("printing-document"));

initialiseTheme();
refreshFormatters();
applyTranslations();
if (!settings.setupComplete) openSetup("language");
else if (settings.setupVersion < SETUP_VERSION) openSetup("country");
