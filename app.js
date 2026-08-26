const STORAGE_KEY = "repairdesk.repairs.v1";
const SETTINGS_KEY = "repairdesk.settings.v1";
const THEME_KEY = "repairdesk.theme";
const DELETED_KEY = "repairdesk.deleted.v1";
const LAST_SYNC_KEY = "repairdesk.cloud.last-sync.v1";
const MIGRATION_KEY_PREFIX = "repairdesk.cloud.migrated.";
const LOCAL_MODE_KEY = "repairdesk.cloud.local-mode.v1";
const CLOUD_SYNC_RETRY_MIN = 1600;
const CLOUD_SYNC_RETRY_MAX = 60000;
const SETUP_VERSION = 2;

const { languages, messages } = RepairDeskI18n;
const { countries, countryByCode, providerList, buildUrl, shoppingUrl, webSearchUrl, recommendedDomains } = RepairDeskCatalog;
const languageByCode = new Map(languages.map((language) => [language.code, language]));
const countryCodes = new Set(countries.map((country) => country.code));
const validStatuses = new Set(["intake", "diagnosis", "approval", "waiting", "in-progress", "quality", "ready", "completed", "cancelled"]);
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
  "cloudStatusCard", "cloudStatusDot", "cloudStatusLabel", "cloudStatusCopy", "accountButton", "mobileAccountButton", "mobileFeedbackButton",
  "accountButtonLabel", "accountPresence", "feedbackButton", "storageFooter", "authDialog", "authSignInTab", "authSignUpTab",
  "authForm", "authWorkshopField", "authWorkshopInput", "authEmailInput", "authPasswordInput", "authConfirmField",
  "authConfirmInput", "authMessage", "authSubmitButton", "authSubmitLabel", "forgotPasswordButton", "localModeButton",
  "resetRequestForm", "resetEmailInput", "resetMessage", "resetBackButton", "confirmationPanel", "confirmationCopy",
  "confirmationBackButton", "accountDialog", "closeAccountButton", "accountAvatar", "accountIdentityLabel", "accountEmail", "accountDescription",
  "lastSyncLabel", "accountSyncBadge", "syncNowButton", "accountSignInButton", "signOutButton", "migrationDialog",
  "localRepairCount", "useCloudDataButton", "mergeLocalDataButton", "feedbackDialog", "feedbackForm", "closeFeedbackButton",
  "cancelFeedbackButton", "feedbackTypeInput", "feedbackMessageInput", "feedbackFormMessage", "sendFeedbackButton",
  "recoveryDialog", "recoveryForm", "recoveryPasswordInput", "recoveryConfirmInput", "recoveryMessage",
  "adminNavButton", "adminMobileNavButton", "adminView", "refreshAdminButton", "adminStatus", "adminTotalUsers",
  "adminNewUsersHint", "adminActiveToday", "adminActiveWeekHint", "adminReturningUsers", "adminOpenFeedback",
  "adminEventsHint", "adminCloudWorkspaces", "adminSyncHealthHint", "adminTotalRepairs", "adminStorageHint",
  "adminDailyChart", "adminEventBreakdown", "adminCountryBreakdown", "adminUserSearch", "adminUserCount",
  "adminUsersTableBody", "adminUsersMoreButton", "adminFeedbackFilter", "adminFeedbackInbox", "adminAuditLog",
  "exportAdminButton",
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

function emptyWorkspaceData() {
  return {
    customers: [], devices: [], inventory: [], suppliers: [], appointments: [], purchaseOrders: [],
    customStatuses: [], savedFilters: [], documentTemplates: [], trash: [], shortcuts: true,
    documentSettings: {
      logoUrl: "", defaultWarrantyDays: 90, receiptTitle: "", invoiceTitle: "",
      footer: "", emailSubject: "", emailMessage: "",
    },
  };
}

function normaliseWorkspaceData(raw = {}) {
  const base = emptyWorkspaceData();
  const arrays = ["customers", "devices", "inventory", "suppliers", "appointments", "purchaseOrders", "customStatuses", "savedFilters", "documentTemplates", "trash"];
  arrays.forEach((key) => { base[key] = Array.isArray(raw?.[key]) ? raw[key].filter((item) => item && typeof item === "object").slice(0, 5000) : []; });
  base.shortcuts = raw?.shortcuts !== false;
  base.documentSettings = {
    logoUrl: String(raw?.documentSettings?.logoUrl || "").slice(0, 500),
    defaultWarrantyDays: Math.min(3650, Math.max(0, Number(raw?.documentSettings?.defaultWarrantyDays) || 90)),
    receiptTitle: String(raw?.documentSettings?.receiptTitle || "").slice(0, 120),
    invoiceTitle: String(raw?.documentSettings?.invoiceTitle || "").slice(0, 120),
    footer: String(raw?.documentSettings?.footer || "").slice(0, 1000),
    emailSubject: String(raw?.documentSettings?.emailSubject || "").slice(0, 200),
    emailMessage: String(raw?.documentSettings?.emailMessage || "").slice(0, 2000),
  };
  return base;
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
    workspace: emptyWorkspaceData(),
    search: { engineId: "" },
    updatedAt: new Date(0).toISOString(),
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
      workspace: normaliseWorkspaceData(parsed.workspace),
      search: { engineId: String(parsed.search?.engineId || "").trim() },
      updatedAt: String(parsed.updatedAt || new Date(0).toISOString()),
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
    price: toAmount(part?.price ?? part?.cost),
    quantity: Math.max(1, Number(part?.quantity) || 1),
    sku: String(part?.sku || "").slice(0, 80),
    supplierId: String(part?.supplierId || "").slice(0, 120),
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
    brand: String(repair?.brand || "").slice(0, 80),
    model: String(repair?.model || repair?.device || "").slice(0, 120),
    imei: String(repair?.imei || "").slice(0, 40),
    customerId: String(repair?.customerId || "").slice(0, 120),
    deviceId: String(repair?.deviceId || "").slice(0, 120),
    category: normalizeCategory(repair?.category),
    issue: String(repair?.issue || "").slice(0, 120),
    ...(repair?.issueKey ? { issueKey: repair.issueKey } : {}),
    serial: String(repair?.serial || "").slice(0, 60),
    status: validStatuses.has(repair?.status) || /^custom-[a-z0-9-]{1,30}$/.test(String(repair?.status || "")) ? repair.status : "in-progress",
    priority: ["low", "normal", "high", "urgent"].includes(repair?.priority) ? repair.priority : "normal",
    tags: Array.isArray(repair?.tags) ? repair.tags.map((tag) => String(tag).trim().slice(0, 40)).filter(Boolean).slice(0, 12) : [],
    assignedTo: String(repair?.assignedTo || "").slice(0, 120),
    received: repair?.received || "",
    target: repair?.target || "",
    labour: toAmount(repair?.labour),
    parts: Array.isArray(repair?.parts) ? repair.parts.map(normalizePart) : [],
    notes: String(repair?.notes || "").slice(0, 600),
    diagnosis: String(repair?.diagnosis || "").slice(0, 3000),
    condition: String(repair?.condition || "").slice(0, 1000),
    accessories: String(repair?.accessories || "").slice(0, 500),
    intakeSignature: String(repair?.intakeSignature || "").slice(0, 200000),
    intakeAccepted: Boolean(repair?.intakeAccepted),
    accessCode: String(repair?.accessCode || "").slice(0, 100),
    ...(repair?.notesKey ? { notesKey: repair.notesKey } : {}),
    customer: {
      name: String(repair?.customer?.name || "").slice(0, 100),
      phone: String(repair?.customer?.phone || "").slice(0, 40),
      email: String(repair?.customer?.email || "").slice(0, 100),
      address: String(repair?.customer?.address || "").slice(0, 160),
    },
    documents: repair?.documents && typeof repair.documents === "object" ? repair.documents : {},
    attachments: Array.isArray(repair?.attachments) ? repair.attachments.filter((item) => item?.id && item?.storagePath).slice(0, 100) : [],
    payments: Array.isArray(repair?.payments) ? repair.payments.filter((item) => item?.id).slice(0, 200) : [],
    estimate: repair?.estimate && typeof repair.estimate === "object" ? repair.estimate : null,
    portalToken: String(repair?.portalToken || "").slice(0, 300),
    warrantyUntil: String(repair?.warrantyUntil || "").slice(0, 10),
    parentRepairId: String(repair?.parentRepairId || "").slice(0, 120),
    completedAt: String(repair?.completedAt || (repair?.status === "completed" ? updatedAt : "")),
    createdAt,
    updatedAt,
  };
  normalized.total = getRepairTotal(normalized);
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

function loadDeletedRepairs() {
  const stored = readStorage(DELETED_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id && item?.deletedAt).slice(-2000) : [];
  } catch { return []; }
}

let deletedRepairs = loadDeletedRepairs();
let cloudConfigured = false;
let cloudUser = null;
let cloudRevision = null;
let cloudSyncTimer = null;
let cloudSyncInFlight = false;
let cloudSyncPending = false;
let cloudSyncState = "local";
let cloudSyncRetryDelay = CLOUD_SYNC_RETRY_MIN;
let authMode = "signin";
let localModeChosen = readStorage(LOCAL_MODE_KEY) === "1";
let pendingCloudSnapshot = null;
let cloudProfile = null;
let adminDashboard = null;
let adminUsers = null;
let adminLoading = false;
let adminUsersLoading = false;
let adminUsersReloadPending = false;
let adminUserSearchTimer = null;

function settingsSnapshot() {
  return {
    language: currentLanguage,
    country: currentCountry,
    currency: currentCurrency,
    setupComplete: Boolean(settings.setupComplete),
    setupVersion: Number(settings.setupVersion) || SETUP_VERSION,
    workshop: { ...emptyWorkshop(), ...(settings.workshop || {}) },
    workspace: normaliseWorkspaceData(settings.workspace),
    search: { engineId: String(settings.search?.engineId || "").trim() },
    updatedAt: String(settings.updatedAt || new Date().toISOString()),
  };
}

function markSettingsChanged() {
  settings.updatedAt = new Date().toISOString();
}

function saveRepairs() {
  if (!writeStorage(STORAGE_KEY, JSON.stringify(repairs))) showToast(t("saveFailed"));
  writeStorage(DELETED_KEY, JSON.stringify(deletedRepairs));
  scheduleCloudSync();
}

function saveSettings() {
  const payload = settingsSnapshot();
  writeStorage(SETTINGS_KEY, JSON.stringify(payload));
  scheduleCloudSync();
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
  document.title = t("pageTitleV020");
  document.querySelector('meta[name="description"]').content = t("pageDescriptionV020");
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
  updateCloudInterface();
  render();
  window.RepairDeskV034?.translate();
}

function render() {
  renderStats();
  renderRepairCards();
  if (activeView === "history") renderHistory();
  if (activeView === "settings") updateRecommendedDomains();
  window.RepairDeskV034?.render(activeView);
}

function renderStats() {
  const waiting = repairs.filter((repair) => ["waiting", "approval"].includes(repair.status)).length;
  const inProgress = repairs.filter((repair) => repair.status === "in-progress").length;
  const completed = repairs.filter((repair) => repair.status === "completed").length;
  const active = repairs.filter((repair) => !["completed", "cancelled"].includes(repair.status)).length;
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
  window.RepairDeskV034?.prepareRepairForm(null);
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
  window.RepairDeskV034?.prepareRepairForm(repair);
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
    target: repair.target, labour: repair.labour, notes: repair.notes, customer: repair.customer, priority: repair.priority,
    tags: repair.tags, assignedTo: repair.assignedTo, diagnosis: repair.diagnosis, condition: repair.condition,
    accessories: repair.accessories, estimate: repair.estimate, payments: repair.payments, warrantyUntil: repair.warrantyUntil,
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
  if (window.RepairDeskV034?.canWrite && !window.RepairDeskV034.canWrite()) {
    showToast(t("workspaceReadOnly"));
    return;
  }
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
    ...(window.RepairDeskV034?.readRepairFields(existing) || {}),
    documents: existing?.documents || {}, history: existing?.history || [], createdAt: existing?.createdAt || now, updatedAt: now,
  });
  recordRepairChanges(existing, repair);
  repairs = existing ? repairs.map((item) => item.id === repair.id ? repair : item) : [repair, ...repairs];
  selectedHistoryId = repair.id;
  saveRepairs();
  window.RepairDeskV034?.afterRepairSaved(repair, existing);
  RepairDeskCloud?.track(existing ? "repair_updated" : "repair_created", { category: repair.category, status: repair.status }).catch(() => {});
  if (existing?.status !== "completed" && repair.status === "completed") RepairDeskCloud?.track("repair_completed", { category: repair.category }).catch(() => {});
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
  if (window.RepairDeskV034?.canWrite && !window.RepairDeskV034.canWrite()) {
    showToast(t("workspaceReadOnly"));
    return;
  }
  const removedRepair = repairs.find((repair) => repair.id === pendingDeleteId);
  settings.workspace = normaliseWorkspaceData(settings.workspace);
  if (removedRepair) settings.workspace.trash = [{ kind: "repair", deletedAt: new Date().toISOString(), data: removedRepair }, ...settings.workspace.trash].slice(0, 200);
  deletedRepairs = [...deletedRepairs.filter((item) => item.id !== pendingDeleteId), { id: pendingDeleteId, deletedAt: new Date().toISOString() }].slice(-2000);
  repairs = repairs.filter((repair) => repair.id !== pendingDeleteId);
  if (selectedHistoryId === pendingDeleteId) selectedHistoryId = repairs[0]?.id || null;
  pendingDeleteId = null;
  saveRepairs();
  saveSettings();
  window.RepairDeskV034?.afterRepairDeleted(removedRepair);
  RepairDeskCloud?.track("repair_deleted").catch(() => {});
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
  const advancedViews = ["repairs", "customers", "devices", "inventory", "calendar", "reports"];
  const allowedViews = ["overview", "history", "settings", ...advancedViews, ...(cloudProfile?.is_admin ? ["admin"] : [])];
  if (!allowedViews.includes(view)) view = "overview";
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
  if (view === "admin" && !window.RepairDeskV034?.handlesAdmin) renderAdminDashboard();
  window.RepairDeskV034?.showView(view, repairId);
  RepairDeskCloud?.track("view_opened", { view }).catch(() => {});
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
  if (window.RepairDeskV034?.canWrite && !window.RepairDeskV034.canWrite()) {
    showToast(t("workspaceReadOnly"));
    return;
  }
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
  markSettingsChanged();
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
  const partRows = repair.parts.map((part) => {
    const quantity = Math.max(1, Number(part.quantity) || 1);
    const unitPrice = toAmount(part.price ?? part.cost);
    return `<tr><td><strong>${escapeHtml(getPartName(part))}</strong>${part.order?.vendor ? `<small>${escapeHtml(part.order.vendor)}</small>` : ""}</td><td>${escapeHtml(quantity)}</td><td>${escapeHtml(formatMoney(unitPrice))}</td><td>${escapeHtml(formatMoney(unitPrice * quantity))}</td></tr>`;
  }).join("");
  const labourRow = repair.labour ? `<tr><td><strong>${escapeHtml(t("labour"))}</strong><small>${escapeHtml(repair.device)}</small></td><td>1</td><td>${escapeHtml(formatMoney(repair.labour))}</td><td>${escapeHtml(formatMoney(repair.labour))}</td></tr>` : "";
  return partRows + labourRow || `<tr><td><strong>${escapeHtml(t("repairService"))}</strong><small>${escapeHtml(repair.device)}</small></td><td>1</td><td>${escapeHtml(formatMoney(0))}</td><td>${escapeHtml(formatMoney(0))}</td></tr>`;
}

function renderDocument(repair, kind, document) {
  const workshop = settings.workshop;
  const documentSettings = settings.workspace?.documentSettings || {};
  const workshopName = workshop.name || t("defaultWorkshopName");
  const documentTitle = String(kind === "receipt" ? documentSettings.receiptTitle : documentSettings.invoiceTitle).trim() || t(kind);
  const logoUrl = safeUrl(documentSettings.logoUrl);
  const footerText = String(documentSettings.footer || "").trim() || t(kind === "receipt" ? "receiptFooter" : "invoiceFooter");
  const signature = String(repair.intakeSignature || "").startsWith("data:image/png;base64,") ? repair.intakeSignature : "";
  const customer = repair.customer;
  const subtotal = getRepairTotal(repair);
  const taxRate = toAmount(workshop.taxRate);
  const tax = subtotal * taxRate / 100;
  const total = subtotal + tax;
  const customerLines = [customer.name || t("noCustomer"), customer.address, customer.phone, customer.email].filter(Boolean);
  const contactLines = documentContactLines();
  elements.documentDialogTitle.textContent = documentTitle;
  elements.documentSheet.innerHTML = `<header class="doc-header"><div>${logoUrl ? `<img class="doc-logo" src="${escapeHtml(logoUrl)}" alt="" />` : `<span class="doc-brand-mark">↳</span>`}<strong>${escapeHtml(workshopName)}</strong><p>${contactLines.map(escapeHtml).join("<br>")}</p></div><div class="doc-title"><span>${escapeHtml(t("repairDocument"))}</span><h1>${escapeHtml(documentTitle)}</h1><p>${escapeHtml(document.number)}</p></div></header><section class="doc-meta"><div><span>${escapeHtml(t("documentNumber"))}</span><strong>${escapeHtml(document.number)}</strong></div><div><span>${escapeHtml(t("issueDate"))}</span><strong>${escapeHtml(formatDate(document.createdAt.slice(0, 10)))}</strong></div><div><span>${escapeHtml(t("repairStatus"))}</span><strong>${escapeHtml(t(repair.status === "in-progress" ? "inProgress" : repair.status))}</strong></div></section><section class="doc-parties"><div><span>${escapeHtml(t("workshop"))}</span><strong>${escapeHtml(workshopName)}</strong><p>${contactLines.map(escapeHtml).join("<br>")}</p></div><div><span>${escapeHtml(t("billTo"))}</span><strong>${escapeHtml(customerLines[0])}</strong><p>${customerLines.slice(1).map(escapeHtml).join("<br>")}</p></div></section><section class="doc-repair"><div><span>${escapeHtml(t("deviceModel"))}</span><strong>${escapeHtml(repair.device)}</strong></div><div><span>${escapeHtml(t("serial"))}</span><strong>${escapeHtml(repair.serial || t("notSet"))}</strong></div><div><span>${escapeHtml(t("issue"))}</span><strong>${escapeHtml(getIssue(repair))}</strong></div></section><table class="doc-table"><thead><tr><th>${escapeHtml(t("description"))}</th><th>${escapeHtml(t("quantity"))}</th><th>${escapeHtml(t("unitPrice"))}</th><th>${escapeHtml(t("amount"))}</th></tr></thead><tbody>${documentItemRows(repair)}</tbody></table><section class="doc-totals"><div><span>${escapeHtml(t("subtotal"))}</span><strong>${escapeHtml(formatMoney(subtotal))}</strong></div><div><span>${escapeHtml(t("taxWithRate", { rate: taxRate }))}</span><strong>${escapeHtml(formatMoney(tax))}</strong></div><div class="doc-grand-total"><span>${escapeHtml(t("total"))}</span><strong>${escapeHtml(formatMoney(total))}</strong></div></section>${getNotes(repair) ? `<section class="doc-notes"><span>${escapeHtml(t("notes"))}</span><p>${escapeHtml(getNotes(repair))}</p></section>` : ""}${kind === "invoice" && workshop.paymentDetails ? `<section class="doc-payment"><span>${escapeHtml(t("paymentDetails"))}</span><p>${escapeHtml(workshop.paymentDetails)}</p></section>` : ""}${signature ? `<section class="doc-signature"><span>${escapeHtml(t("intakeSignature"))}</span><img src="${escapeHtml(signature)}" alt="" /></section>` : ""}<footer class="doc-footer"><p>${escapeHtml(footerText)}</p><span>RepairDesk · Pikaneth (Sviatoslav)</span></footer>`;
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
  markSettingsChanged();
  saveSettings();
  applyTranslations();
  elements.setupDialog.close();
  RepairDeskCloud?.updateProfile({ workshopName: settings.workshop.name, language: currentLanguage, country: currentCountry, currency: currentCurrency, onboardingCompleted: true }).catch(() => {});
  RepairDeskCloud?.track("onboarding_completed", { language: currentLanguage, country: currentCountry }).catch(() => {});
  if (cloudConfigured && !cloudUser && !localModeChosen) openAuthDialog("signup");
}

function closeDialogFromBackdrop(event) {
  const dialog = event.currentTarget;
  const bounds = dialog.getBoundingClientRect();
  const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  if (outside) dialog.close();
}

function parseStoredArray(key) {
  const value = readStorage(key);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function newestDate(left, right) {
  const leftTime = new Date(left || 0).getTime() || 0;
  const rightTime = new Date(right || 0).getTime() || 0;
  return leftTime >= rightTime ? left : right;
}

function mergeDeletedLists(left = [], right = []) {
  const merged = new Map();
  [...left, ...right].forEach((item) => {
    if (!item?.id || !item?.deletedAt) return;
    const existing = merged.get(item.id);
    if (!existing || newestDate(item.deletedAt, existing.deletedAt) === item.deletedAt) merged.set(item.id, { id: String(item.id), deletedAt: String(item.deletedAt) });
  });
  return [...merged.values()].sort((a, b) => new Date(a.deletedAt) - new Date(b.deletedAt)).slice(-2000);
}

function mergeRepairLists(left = [], right = [], tombstones = []) {
  const merged = new Map();
  [...left, ...right].forEach((raw) => {
    if (!raw?.id) return;
    const repair = normalizeRepair(raw);
    const existing = merged.get(repair.id);
    if (!existing || newestDate(repair.updatedAt, existing.updatedAt) === repair.updatedAt) merged.set(repair.id, repair);
  });
  const deletedById = new Map(tombstones.map((item) => [item.id, item.deletedAt]));
  return [...merged.values()].filter((repair) => {
    const deletedAt = deletedById.get(repair.id);
    return !deletedAt || new Date(repair.updatedAt || 0) > new Date(deletedAt);
  }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function normaliseSettingsSnapshot(raw = {}) {
  const language = languageByCode.has(raw.language) ? raw.language : currentLanguage;
  const country = countryCodes.has(raw.country) ? raw.country : detectCountry(language);
  const currency = currencies.includes(raw.currency) ? raw.currency : detectCurrency(country);
  return {
    language,
    country,
    currency,
    setupComplete: Boolean(raw.setupComplete),
    setupVersion: Number(raw.setupVersion) || 0,
    workshop: { ...emptyWorkshop(), ...(raw.workshop || {}) },
    search: { engineId: String(raw.search?.engineId || "").trim() },
    updatedAt: String(raw.updatedAt || new Date(0).toISOString()),
  };
}

function chooseNewestSettings(left, right) {
  const leftSettings = normaliseSettingsSnapshot(left || {});
  const rightSettings = normaliseSettingsSnapshot(right || {});
  return newestDate(leftSettings.updatedAt, rightSettings.updatedAt) === leftSettings.updatedAt ? leftSettings : rightSettings;
}

function applySnapshot(snapshot) {
  const nextSettings = normaliseSettingsSnapshot(snapshot?.settings || {});
  repairs = Array.isArray(snapshot?.repairs) ? snapshot.repairs.map(normalizeRepair) : [];
  deletedRepairs = Array.isArray(snapshot?.deleted_repairs) ? snapshot.deleted_repairs : [];
  Object.assign(settings, nextSettings);
  currentLanguage = nextSettings.language;
  currentCountry = nextSettings.country;
  currentCurrency = nextSettings.currency;
  writeStorage(STORAGE_KEY, JSON.stringify(repairs));
  writeStorage(SETTINGS_KEY, JSON.stringify(nextSettings));
  writeStorage(DELETED_KEY, JSON.stringify(deletedRepairs));
  applyTranslations();
  populateSettingsForm();
  render();
}

function migrationKey(user = cloudUser) {
  return user?.id ? `${MIGRATION_KEY_PREFIX}${user.id}` : "";
}

function localRepairsWereEdited() {
  return Boolean(readStorage(STORAGE_KEY)) && parseStoredArray(STORAGE_KEY).length > 0;
}

function formatSyncTime(value) {
  if (!value) return t("neverSynced");
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? t("neverSynced") : dateTimeFormatter.format(date);
}

function setCloudState(nextState) {
  cloudSyncState = nextState;
  updateCloudInterface();
}

function updateCloudInterface() {
  if (!elements.cloudStatusCard) return;
  const online = typeof navigator.onLine === "boolean" ? navigator.onLine : true;
  let labelKey = "cloudLocal";
  let copyKey = "cloudLocalCopy";
  let visualState = "local";
  if (cloudUser && cloudSyncState === "syncing") {
    labelKey = "cloudSyncing";
    copyKey = "cloudReadyCopy";
    visualState = "syncing";
  } else if (cloudUser && (!online || cloudSyncState === "offline")) {
    labelKey = "cloudOffline";
    copyKey = "cloudErrorCopy";
    visualState = "offline";
  } else if (cloudUser && cloudSyncState === "error") {
    labelKey = "cloudOffline";
    copyKey = "cloudErrorCopy";
    visualState = "error";
  } else if (cloudUser) {
    labelKey = "cloudReady";
    copyKey = "cloudReadyCopy";
    visualState = "ready";
  }
  elements.cloudStatusCard.dataset.state = visualState;
  elements.cloudStatusLabel.textContent = t(labelKey);
  elements.cloudStatusCopy.textContent = t(copyKey);
  elements.accountPresence.classList.toggle("online", Boolean(cloudUser && online));
  elements.accountIdentityLabel.textContent = t(cloudUser ? "signedInAs" : "workspaceMode");
  elements.accountEmail.textContent = cloudUser?.email || t("cloudLocal");
  elements.accountAvatar.textContent = String(cloudUser?.email || settings.workshop.name || "P").trim().charAt(0).toUpperCase() || "P";
  elements.accountDescription.textContent = t(cloudUser ? "accountCloudCopy" : "localModeCopy");
  elements.accountSyncBadge.textContent = t(labelKey);
  elements.lastSyncLabel.textContent = formatSyncTime(readStorage(LAST_SYNC_KEY));
  elements.syncNowButton.hidden = !cloudUser;
  elements.signOutButton.hidden = !cloudUser;
  elements.accountSignInButton.hidden = Boolean(cloudUser);
  elements.storageFooter.textContent = t(cloudUser ? "cloudFooter" : "localFooterV020");
  const adminVisible = Boolean(cloudUser && cloudProfile?.is_admin);
  elements.adminNavButton.hidden = !adminVisible;
  elements.adminMobileNavButton.hidden = !adminVisible;
  window.RepairDeskV034?.updateAccount({ user: cloudUser, profile: cloudProfile, adminVisible, syncState: cloudSyncState });
  if (!adminVisible && activeView === "admin") showView("overview");
}

function scheduleCloudSync(delay = 700) {
  if (!cloudConfigured || !cloudUser) return;
  clearTimeout(cloudSyncTimer);
  cloudSyncPending = true;
  if (typeof navigator.onLine === "boolean" && !navigator.onLine) {
    setCloudState("offline");
    return;
  }
  cloudSyncTimer = setTimeout(() => performCloudSync(), delay);
}

async function resolveCloudConflict(remoteSnapshot) {
  const mergedDeleted = mergeDeletedLists(deletedRepairs, remoteSnapshot?.deleted_repairs || []);
  const mergedRepairs = mergeRepairLists(repairs, remoteSnapshot?.repairs || [], mergedDeleted);
  const mergedSettings = chooseNewestSettings(settingsSnapshot(), remoteSnapshot?.settings || {});
  applySnapshot({ repairs: mergedRepairs, settings: mergedSettings, deleted_repairs: mergedDeleted });
  cloudRevision = Number(remoteSnapshot?.revision) || null;
}

async function performCloudSync({ notify = false, retry = true } = {}) {
  if (!cloudConfigured || !cloudUser) return false;
  if (cloudSyncInFlight) {
    cloudSyncPending = true;
    return false;
  }
  if (typeof navigator.onLine === "boolean" && !navigator.onLine) {
    cloudSyncPending = true;
    setCloudState("offline");
    return false;
  }
  cloudSyncInFlight = true;
  cloudSyncPending = false;
  setCloudState("syncing");
  try {
    let result = await RepairDeskCloud.saveSnapshot({ repairs, settings: settingsSnapshot(), deletedRepairs, expectedRevision: cloudRevision });
    if (result?.conflict && retry) {
      const remote = await RepairDeskCloud.loadSnapshot();
      await resolveCloudConflict(remote);
      result = await RepairDeskCloud.saveSnapshot({ repairs, settings: settingsSnapshot(), deletedRepairs, expectedRevision: cloudRevision });
      showToast(t("syncConflictResolved"));
    }
    if (!result?.ok) throw new Error("Cloud revision conflict.");
    cloudRevision = Number(result.revision) || cloudRevision;
    const syncedAt = result.updated_at || new Date().toISOString();
    writeStorage(LAST_SYNC_KEY, syncedAt);
    cloudSyncRetryDelay = CLOUD_SYNC_RETRY_MIN;
    setCloudState("ready");
    if (notify) showToast(t("syncSuccess"));
    return true;
  } catch (error) {
    cloudSyncPending = true;
    setCloudState("error");
    if (notify) showToast(t("syncFailed"));
    return false;
  } finally {
    cloudSyncInFlight = false;
    if (cloudSyncPending && (typeof navigator.onLine !== "boolean" || navigator.onLine)) {
      const retryDelay = cloudSyncRetryDelay;
      cloudSyncRetryDelay = Math.min(cloudSyncRetryDelay * 2, CLOUD_SYNC_RETRY_MAX);
      scheduleCloudSync(retryDelay);
    }
  }
}

function openAuthDialog(mode = "signin") {
  setAuthMode(mode);
  elements.authMessage.textContent = cloudConfigured ? "" : t("cloudNotConfigured");
  elements.authMessage.classList.toggle("success", false);
  elements.resetRequestForm.hidden = true;
  elements.confirmationPanel.hidden = true;
  elements.authForm.hidden = false;
  document.querySelector(".auth-tabs").hidden = false;
  document.querySelector(".auth-links").hidden = false;
  if (!elements.authDialog.open) elements.authDialog.showModal();
  requestAnimationFrame(() => elements.authEmailInput.focus());
}

function setAuthMode(mode) {
  authMode = mode === "signup" ? "signup" : "signin";
  const signingUp = authMode === "signup";
  elements.authSignInTab.classList.toggle("active", !signingUp);
  elements.authSignUpTab.classList.toggle("active", signingUp);
  elements.authSignInTab.setAttribute("aria-selected", String(!signingUp));
  elements.authSignUpTab.setAttribute("aria-selected", String(signingUp));
  elements.authWorkshopField.hidden = !signingUp;
  elements.authConfirmField.hidden = !signingUp;
  elements.authPasswordInput.autocomplete = signingUp ? "new-password" : "current-password";
  elements.authSubmitLabel.textContent = t(signingUp ? "createAccount" : "signIn");
  elements.authMessage.textContent = "";
}

function setFormBusy(form, busy) {
  form.querySelectorAll("button, input, select, textarea").forEach((control) => { control.disabled = busy; });
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

async function submitAuth(event) {
  event.preventDefault();
  const email = elements.authEmailInput.value.trim();
  const password = elements.authPasswordInput.value;
  elements.authMessage.classList.remove("success");
  if (!cloudConfigured) {
    elements.authMessage.textContent = t("cloudNotConfigured");
    return;
  }
  if (!validEmail(email)) {
    elements.authMessage.textContent = t("authInvalidEmail");
    return;
  }
  if (password.length < 8) {
    elements.authMessage.textContent = t("authPasswordShort");
    return;
  }
  if (authMode === "signup" && !elements.authWorkshopInput.value.trim()) {
    elements.authMessage.textContent = t("authWorkshopRequired");
    return;
  }
  if (authMode === "signup" && password !== elements.authConfirmInput.value) {
    elements.authMessage.textContent = t("authPasswordsMismatch");
    return;
  }
  setFormBusy(elements.authForm, true);
  elements.authMessage.textContent = t("authWorking");
  try {
    if (authMode === "signup") {
      settings.workshop.name = elements.authWorkshopInput.value.trim();
      markSettingsChanged();
      saveSettings();
      const data = await RepairDeskCloud.signUp({ email, password, workshopName: settings.workshop.name, language: currentLanguage, country: currentCountry, currency: currentCurrency });
      if (!data.session) {
        elements.authForm.hidden = true;
        document.querySelector(".auth-tabs").hidden = true;
        document.querySelector(".auth-links").hidden = true;
        elements.confirmationCopy.textContent = t("emailConfirmationCopy", { email });
        elements.confirmationPanel.hidden = false;
      } else await completeCloudSignIn(data.user, "registered");
    } else {
      const data = await RepairDeskCloud.signIn(email, password);
      await completeCloudSignIn(data.user, "signed_in");
    }
  } catch (error) {
    elements.authMessage.textContent = error?.message || t("authGenericError");
  } finally {
    setFormBusy(elements.authForm, false);
  }
}

function showResetRequest() {
  elements.authForm.hidden = true;
  document.querySelector(".auth-tabs").hidden = true;
  document.querySelector(".auth-links").hidden = true;
  elements.confirmationPanel.hidden = true;
  elements.resetRequestForm.hidden = false;
  elements.resetEmailInput.value = elements.authEmailInput.value;
  elements.resetMessage.textContent = "";
  elements.resetEmailInput.focus();
}

function hideResetRequest() {
  elements.resetRequestForm.hidden = true;
  elements.authForm.hidden = false;
  document.querySelector(".auth-tabs").hidden = false;
  document.querySelector(".auth-links").hidden = false;
}

async function submitResetRequest(event) {
  event.preventDefault();
  const email = elements.resetEmailInput.value.trim();
  elements.resetMessage.classList.remove("success");
  if (!validEmail(email)) {
    elements.resetMessage.textContent = t("authInvalidEmail");
    return;
  }
  setFormBusy(elements.resetRequestForm, true);
  try {
    await RepairDeskCloud.sendPasswordReset(email);
    elements.resetMessage.textContent = t("resetSent");
    elements.resetMessage.classList.add("success");
  } catch (error) {
    elements.resetMessage.textContent = error?.message || t("authGenericError");
  } finally {
    setFormBusy(elements.resetRequestForm, false);
  }
}

function continueLocally() {
  localModeChosen = true;
  writeStorage(LOCAL_MODE_KEY, "1");
  if (elements.authDialog.open) elements.authDialog.close();
  setCloudState("local");
  if (!settings.setupComplete) openSetup("language");
  else if (settings.setupVersion < SETUP_VERSION) openSetup("country");
}

async function loadCloudWorkspace(user) {
  if (!user) return;
  cloudUser = user;
  setCloudState("syncing");
  const [snapshot, profile, workshopAccess, runtimeConfig] = await Promise.all([
    RepairDeskCloud.loadSnapshot(),
    RepairDeskCloud.loadProfile(),
    RepairDeskCloud.loadWorkshop().catch(() => null),
    RepairDeskCloud.loadRuntimeConfig().catch(() => null),
  ]);
  cloudProfile = profile;
  window.RepairDeskV034?.setCloudContext({ workshopAccess, runtimeConfig });
  adminDashboard = null;
  adminUsers = null;
  updateCloudInterface();
  const migrated = Boolean(readStorage(migrationKey(user)));
  if (localRepairsWereEdited() && !migrated) {
    pendingCloudSnapshot = snapshot;
    elements.localRepairCount.textContent = t("localRepairsFound", { count: parseStoredArray(STORAGE_KEY).length });
    elements.useCloudDataButton.hidden = !snapshot;
    if (!elements.migrationDialog.open) elements.migrationDialog.showModal();
    setCloudState("ready");
  } else if (snapshot) {
    cloudRevision = Number(snapshot.revision) || null;
    applySnapshot(snapshot);
    writeStorage(LAST_SYNC_KEY, snapshot.updated_at || new Date().toISOString());
    setCloudState("ready");
  } else {
    cloudRevision = null;
    repairs = [];
    deletedRepairs = [];
    writeStorage(STORAGE_KEY, JSON.stringify(repairs));
    writeStorage(DELETED_KEY, JSON.stringify(deletedRepairs));
    render();
    await performCloudSync();
  }
  await RepairDeskCloud.updateProfile({ workshopName: settings.workshop.name, language: currentLanguage, country: currentCountry, currency: currentCurrency, onboardingCompleted: settings.setupComplete }).catch(() => {});
  await RepairDeskCloud.track("app_open", { language: currentLanguage, country: currentCountry, local_data: localRepairsWereEdited() });
  updateCloudInterface();
}

async function completeCloudSignIn(user, authEvent = "") {
  if (!user) return;
  if (elements.authDialog.open) elements.authDialog.close();
  try {
    await loadCloudWorkspace(user);
    localModeChosen = false;
    writeStorage(LOCAL_MODE_KEY, "0");
    if (authEvent) await RepairDeskCloud.track(`account_${authEvent}`);
    if (!settings.setupComplete && !elements.migrationDialog.open) openSetup("language");
    else if (settings.setupVersion < SETUP_VERSION && !elements.migrationDialog.open) openSetup("country");
    else if (cloudProfile?.is_admin && adminViewRequested()) showView("admin");
  } catch {
    cloudUser = user;
    setCloudState("error");
    showToast(t("syncFailed"));
  }
}

async function handleAuthStateChange(event, session) {
  if (event === "PASSWORD_RECOVERY") {
    if (!elements.recoveryDialog.open) elements.recoveryDialog.showModal();
    return;
  }
  if (event === "SIGNED_OUT") {
    clearTimeout(cloudSyncTimer);
    cloudSyncPending = false;
    cloudSyncRetryDelay = CLOUD_SYNC_RETRY_MIN;
    cloudUser = null;
    cloudProfile = null;
    window.RepairDeskV034?.setCloudContext({ workshopAccess: null, runtimeConfig: null });
    adminDashboard = null;
    adminUsers = null;
    adminUsersReloadPending = false;
    clearTimeout(adminUserSearchTimer);
    cloudRevision = null;
    pendingCloudSnapshot = null;
    setCloudState("local");
    return;
  }
  if (event === "SIGNED_IN" && session?.user && cloudUser?.id !== session.user.id) await completeCloudSignIn(session.user);
}

async function mergeLocalIntoCloud() {
  setFormBusy(elements.migrationDialog, true);
  try {
    const remote = pendingCloudSnapshot;
    const mergedDeleted = mergeDeletedLists(deletedRepairs, remote?.deleted_repairs || []);
    const mergedRepairs = mergeRepairLists(repairs, remote?.repairs || [], mergedDeleted);
    const mergedSettings = chooseNewestSettings(settingsSnapshot(), remote?.settings || {});
    cloudRevision = Number(remote?.revision) || null;
    applySnapshot({ repairs: mergedRepairs, settings: mergedSettings, deleted_repairs: mergedDeleted });
    const success = await performCloudSync({ notify: true });
    if (!success) return;
    writeStorage(migrationKey(), "1");
    pendingCloudSnapshot = null;
    elements.migrationDialog.close();
    if (!settings.setupComplete) openSetup("language");
  } finally {
    setFormBusy(elements.migrationDialog, false);
  }
}

async function useCloudSnapshot() {
  const remote = pendingCloudSnapshot;
  if (!remote) return;
  setFormBusy(elements.migrationDialog, true);
  try {
    cloudRevision = Number(remote.revision) || null;
    applySnapshot(remote);
    writeStorage(LAST_SYNC_KEY, remote.updated_at || new Date().toISOString());
    updateCloudInterface();
    writeStorage(migrationKey(), "1");
    pendingCloudSnapshot = null;
    elements.migrationDialog.close();
    if (!settings.setupComplete) openSetup("language");
  } finally {
    setFormBusy(elements.migrationDialog, false);
  }
}

function adminCount(value) {
  return new Intl.NumberFormat(currentLocale()).format(Number(value) || 0);
}

function formatAdminBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${adminCount(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = bytes / 1024;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  return `${new Intl.NumberFormat(currentLocale(), { maximumFractionDigits: amount >= 10 ? 1 : 2 }).format(amount)} ${units[index]}`;
}

function renderAdminBreakdown(element, rows = [], labelField = "name") {
  element.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "admin-empty compact";
    empty.textContent = t("noAnalyticsYet");
    element.append(empty);
    return;
  }
  const maximum = Math.max(1, ...rows.map((row) => Number(row.count) || 0));
  rows.forEach((row) => {
    const count = Number(row.count) || 0;
    const item = document.createElement("div");
    item.className = "admin-breakdown-row";
    const label = String(row[labelField] || "—").replaceAll("_", " ");
    item.innerHTML = `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(adminCount(count))}</strong></div><i><span style="width:${Math.max(3, count / maximum * 100)}%"></span></i>`;
    element.append(item);
  });
}

function renderAdminChart(daily = []) {
  elements.adminDailyChart.replaceChildren();
  if (!daily.length) {
    const empty = document.createElement("p");
    empty.className = "admin-empty";
    empty.textContent = t("noAnalyticsYet");
    elements.adminDailyChart.append(empty);
    return;
  }
  const byDay = new Map(daily.map((row) => [String(row.day || "").slice(0, 10), row]));
  const days = [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  for (let offset = 29; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    days.push({ date, key, ...(byDay.get(key) || {}) });
  }
  const maxUsers = Math.max(1, ...days.map((row) => Number(row.active_users) || 0));
  const maxEvents = Math.max(1, ...days.map((row) => Number(row.events) || 0));
  const compactDate = new Intl.DateTimeFormat(currentLocale(), { day: "numeric", month: "short" });
  days.forEach((row, index) => {
    const users = Number(row.active_users) || 0;
    const events = Number(row.events) || 0;
    const item = document.createElement("div");
    item.className = "admin-day";
    item.title = `${compactDate.format(row.date)} · ${t("activeUsers")}: ${users} · ${t("events")}: ${events}`;
    const userHeight = users ? Math.max(5, users / maxUsers * 100) : 0;
    const eventHeight = events ? Math.max(5, events / maxEvents * 100) : 0;
    const label = index % 5 === 0 || index === days.length - 1 ? compactDate.format(row.date) : "·";
    item.innerHTML = `<div class="admin-day-bars"><i class="users" style="height:${userHeight}%;${users ? "" : "min-height:0"}"></i><i class="events" style="height:${eventHeight}%;${events ? "" : "min-height:0"}"></i></div><time datetime="${escapeHtml(row.key)}">${escapeHtml(label)}</time>`;
    elements.adminDailyChart.append(item);
  });
}

function renderAdminUsers() {
  const rows = Array.isArray(adminUsers?.users) ? adminUsers.users : [];
  const total = Number(adminUsers?.total) || 0;
  elements.adminUsersTableBody.replaceChildren();
  elements.adminUserCount.textContent = t("adminUserCount", { shown: adminCount(rows.length), total: adminCount(total) });
  if (!rows.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="7" class="admin-table-empty">${escapeHtml(t("noUsers"))}</td>`;
    elements.adminUsersTableBody.append(row);
  } else {
    rows.forEach((user) => {
      const row = document.createElement("tr");
      const confirmed = Boolean(user.email_confirmed_at);
      const identity = user.email || String(user.id || "").slice(0, 12) || "—";
      const workshop = user.workshop_name || t("defaultWorkshopName");
      const activeAt = user.last_seen_at || user.last_sign_in_at;
      row.innerHTML = `<td><div class="admin-user-identity"><strong>${escapeHtml(identity)}</strong><span>${escapeHtml(workshop)}</span><i class="${confirmed ? "confirmed" : "pending"}">${escapeHtml(t(confirmed ? "confirmed" : "pendingConfirmation"))}</i></div></td><td><strong>${escapeHtml(user.country || "—")}</strong><span class="admin-cell-meta">${escapeHtml([user.language, user.currency].filter(Boolean).join(" · "))}</span></td><td><time datetime="${escapeHtml(user.created_at || "")}">${escapeHtml(formatDateTime(user.created_at))}</time></td><td><time datetime="${escapeHtml(activeAt || "")}">${escapeHtml(activeAt ? formatDateTime(activeAt) : t("notSet"))}</time></td><td><time datetime="${escapeHtml(user.last_sync_at || "")}">${escapeHtml(formatSyncTime(user.last_sync_at))}</time><span class="admin-cell-meta">r${escapeHtml(adminCount(user.revision))}</span></td><td>${escapeHtml(adminCount(user.repair_count))}</td><td>${escapeHtml(formatAdminBytes(user.snapshot_bytes))}</td>`;
      elements.adminUsersTableBody.append(row);
    });
  }
  elements.adminUsersMoreButton.hidden = rows.length >= total;
  elements.adminUsersMoreButton.disabled = adminUsersLoading;
}

function renderAdminAudit(audit = []) {
  elements.adminAuditLog.replaceChildren();
  if (!audit.length) {
    const empty = document.createElement("p");
    empty.className = "admin-empty compact";
    empty.textContent = t("noAudit");
    elements.adminAuditLog.append(empty);
    return;
  }
  audit.forEach((item) => {
    const article = document.createElement("article");
    article.className = "admin-audit-item";
    const details = item.details || {};
    const description = item.action === "feedback_status_changed"
      ? t("feedbackStatusChangeAudit", { id: item.target_id || "—", from: feedbackStatusLabel(details.from), to: feedbackStatusLabel(details.to) })
      : String(item.action || "—").replaceAll("_", " ");
    article.innerHTML = `<span class="admin-audit-mark" aria-hidden="true">↳</span><div><strong>${escapeHtml(description)}</strong><span>${escapeHtml(item.admin_email || "—")} · ${escapeHtml(formatDateTime(item.created_at))}</span></div>`;
    elements.adminAuditLog.append(article);
  });
}

function feedbackStatusLabel(status) {
  const key = { new: "feedbackStatusNew", reviewing: "feedbackStatusReviewing", planned: "feedbackStatusPlanned", resolved: "feedbackStatusResolved", closed: "feedbackStatusClosed" }[status];
  return t(key || "feedbackStatusNew");
}

function renderAdminFeedback(feedback = []) {
  elements.adminFeedbackInbox.replaceChildren();
  const filter = elements.adminFeedbackFilter.value || "all";
  const visible = filter === "all" ? feedback : feedback.filter((item) => item.status === filter);
  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "admin-empty";
    empty.textContent = t("noFeedbackYet");
    elements.adminFeedbackInbox.append(empty);
    return;
  }
  const statuses = ["new", "reviewing", "planned", "resolved", "closed"];
  visible.forEach((item) => {
    const article = document.createElement("article");
    article.className = "admin-feedback-item";
    article.dataset.feedbackId = String(item.id);
    const typeKey = { idea: "feedbackIdea", bug: "feedbackBug", other: "feedbackOther" }[item.type] || "feedbackOther";
    const meta = [item.workshop_name || t("defaultWorkshopName"), item.user_email, item.page, item.app_version ? `v${item.app_version}` : ""].filter(Boolean).join(" · ");
    const options = statuses.map((status) => `<option value="${status}"${status === item.status ? " selected" : ""}>${escapeHtml(feedbackStatusLabel(status))}</option>`).join("");
    article.innerHTML = `<div><header><span class="admin-feedback-type">${escapeHtml(t(typeKey))}</span><time datetime="${escapeHtml(item.created_at || "")}">${escapeHtml(formatDateTime(item.created_at))}</time></header><p>${escapeHtml(item.message || "")}</p><span class="admin-feedback-meta">${escapeHtml(meta)}</span></div><select class="admin-feedback-status" data-feedback-status aria-label="${escapeHtml(t("feedbackStatus"))}">${options}</select>`;
    elements.adminFeedbackInbox.append(article);
  });
}

function renderAdminData() {
  const totals = adminDashboard?.totals || {};
  elements.adminTotalUsers.textContent = adminCount(totals.total_users);
  elements.adminNewUsersHint.textContent = t("adminNewUsers", { count: adminCount(totals.new_users_30d) });
  elements.adminActiveToday.textContent = adminCount(totals.active_today);
  elements.adminActiveWeekHint.textContent = t("adminActiveWeek", { count: adminCount(totals.active_7d) });
  elements.adminReturningUsers.textContent = adminCount(totals.returning_30d);
  elements.adminOpenFeedback.textContent = adminCount(totals.open_feedback);
  elements.adminEventsHint.textContent = t("adminEvents30d", { count: adminCount(totals.events_30d) });
  elements.adminCloudWorkspaces.textContent = adminCount(totals.cloud_workspaces);
  elements.adminSyncHealthHint.textContent = `${t("adminSync24h", { count: adminCount(totals.active_workspaces_24h) })} · ${t("adminStale30d", { count: adminCount(totals.stale_workspaces_30d) })}`;
  elements.adminTotalRepairs.textContent = adminCount(totals.total_repairs);
  elements.adminStorageHint.textContent = t("adminStorageUsed", { size: formatAdminBytes(totals.storage_bytes) });
  renderAdminChart(Array.isArray(adminDashboard?.daily) ? adminDashboard.daily : []);
  renderAdminBreakdown(elements.adminEventBreakdown, Array.isArray(adminDashboard?.event_breakdown) ? adminDashboard.event_breakdown : [], "name");
  renderAdminBreakdown(elements.adminCountryBreakdown, Array.isArray(adminDashboard?.country_breakdown) ? adminDashboard.country_breakdown : [], "country");
  renderAdminUsers();
  renderAdminFeedback(Array.isArray(adminDashboard?.feedback) ? adminDashboard.feedback : []);
  renderAdminAudit(Array.isArray(adminDashboard?.audit) ? adminDashboard.audit : []);
}

async function loadAdminUserDirectory(reset = true) {
  if (!cloudProfile?.is_admin) return;
  if (adminUsersLoading) {
    if (reset) adminUsersReloadPending = true;
    return;
  }
  const query = elements.adminUserSearch.value.trim();
  const append = !reset && adminUsers?.query === query;
  const offset = append ? (Array.isArray(adminUsers?.users) ? adminUsers.users.length : 0) : 0;
  adminUsersLoading = true;
  elements.adminUsersMoreButton.disabled = true;
  try {
    const page = await RepairDeskCloud.loadAdminUsers(query, 50, offset);
    if (!cloudProfile?.is_admin || query !== elements.adminUserSearch.value.trim()) return;
    const nextRows = Array.isArray(page?.users) ? page.users : [];
    const previousRows = append && Array.isArray(adminUsers?.users) ? adminUsers.users : [];
    const unique = new Map([...previousRows, ...nextRows].map((item) => [String(item.id), item]));
    adminUsers = { ...page, query, users: [...unique.values()] };
    renderAdminUsers();
  } catch {
    elements.adminStatus.textContent = t("adminUsersLoadFailed");
    elements.adminStatus.classList.add("error");
  } finally {
    adminUsersLoading = false;
    elements.adminUsersMoreButton.disabled = false;
    if (adminUsersReloadPending && cloudProfile?.is_admin) {
      adminUsersReloadPending = false;
      loadAdminUserDirectory(true);
    }
  }
}

async function renderAdminDashboard(force = false) {
  if (!cloudProfile?.is_admin || adminLoading) return;
  const adminUserId = cloudUser?.id;
  if (adminDashboard && !force) {
    renderAdminData();
    if (!adminUsers) await loadAdminUserDirectory(true);
    return;
  }
  adminLoading = true;
  elements.refreshAdminButton.disabled = true;
  elements.adminView.setAttribute("aria-busy", "true");
  elements.adminStatus.classList.remove("error");
  elements.adminStatus.textContent = t("analyticsLoading");
  try {
    const query = elements.adminUserSearch.value.trim();
    const [dashboard, users] = await Promise.all([
      RepairDeskCloud.loadAdminDashboard(),
      RepairDeskCloud.loadAdminUsers(query, 50, 0),
    ]);
    if (!cloudProfile?.is_admin || cloudUser?.id !== adminUserId) return;
    adminDashboard = dashboard;
    adminUsers = { ...users, query, users: Array.isArray(users?.users) ? users.users : [] };
    renderAdminData();
    elements.adminStatus.textContent = t("analyticsUpdated", { time: formatSyncTime(adminDashboard?.generated_at) });
  } catch {
    elements.adminStatus.textContent = t("analyticsLoadFailed");
    elements.adminStatus.classList.add("error");
  } finally {
    adminLoading = false;
    elements.refreshAdminButton.disabled = false;
    elements.adminView.setAttribute("aria-busy", "false");
  }
}

async function changeFeedbackStatus(select) {
  const article = select.closest("[data-feedback-id]");
  const item = adminDashboard?.feedback?.find((entry) => String(entry.id) === article?.dataset.feedbackId);
  if (!item) return;
  const previous = item.status;
  const next = select.value;
  if (previous === next) return;
  select.disabled = true;
  try {
    await RepairDeskCloud.updateFeedbackStatus(item.id, next);
    item.status = next;
    adminDashboard.audit = [{
      id: `local-${Date.now()}`,
      action: "feedback_status_changed",
      target_type: "feedback",
      target_id: String(item.id),
      details: { from: previous, to: next },
      created_at: new Date().toISOString(),
      admin_email: cloudUser?.email || "",
    }, ...(Array.isArray(adminDashboard.audit) ? adminDashboard.audit : [])].slice(0, 30);
    const open = new Set(["new", "reviewing", "planned"]);
    if (open.has(previous) !== open.has(next)) adminDashboard.totals.open_feedback = Math.max(0, Number(adminDashboard.totals.open_feedback) + (open.has(next) ? 1 : -1));
    renderAdminData();
    showToast(t("feedbackStatusUpdated"));
  } catch {
    select.value = previous;
    showToast(t("feedbackStatusFailed"));
  } finally {
    select.disabled = false;
  }
}

function adminCsvCell(value) {
  let text = String(value ?? "");
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function exportAdminCsv() {
  if (!cloudProfile?.is_admin || !adminDashboard) return;
  const totals = adminDashboard.totals || {};
  const users = Array.isArray(adminUsers?.users) ? adminUsers.users : [];
  const rows = [
    ["RepairDesk owner report", new Date().toISOString()],
    ["Registered users", totals.total_users || 0],
    ["Active today", totals.active_today || 0],
    ["Active in 7 days", totals.active_7d || 0],
    ["Returning in 30 days", totals.returning_30d || 0],
    ["Cloud workspaces", totals.cloud_workspaces || 0],
    ["Repairs managed", totals.total_repairs || 0],
    ["Storage bytes", totals.storage_bytes || 0],
    [],
    ["Email", "Workshop", "Country", "Language", "Currency", "Confirmed", "Joined", "Last active", "Last sync", "Repairs", "Snapshot bytes"],
    ...users.map((user) => [
      user.email,
      user.workshop_name,
      user.country,
      user.language,
      user.currency,
      Boolean(user.email_confirmed_at),
      user.created_at,
      user.last_seen_at || user.last_sign_in_at || "",
      user.last_sync_at || "",
      user.repair_count || 0,
      user.snapshot_bytes || 0,
    ]),
  ];
  const csv = rows.map((row) => row.map(adminCsvCell).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `repairdesk-owner-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast(t("adminExportReady"));
}

function openAccountDialog() {
  updateCloudInterface();
  if (!elements.accountDialog.open) elements.accountDialog.showModal();
}

async function signOutAccount() {
  setFormBusy(elements.accountDialog, true);
  try {
    await performCloudSync();
    await RepairDeskCloud.signOut();
    elements.accountDialog.close();
    showToast(t("cloudLocal"));
  } catch (error) {
    showToast(error?.message || t("authGenericError"));
  } finally {
    setFormBusy(elements.accountDialog, false);
  }
}

function openFeedbackDialog() {
  if (!cloudUser) {
    showToast(t("feedbackSignInRequired"));
    openAuthDialog("signin");
    return;
  }
  elements.feedbackFormMessage.textContent = "";
  if (!elements.feedbackDialog.open) elements.feedbackDialog.showModal();
  elements.feedbackMessageInput.focus();
}

async function submitFeedback(event) {
  event.preventDefault();
  const message = elements.feedbackMessageInput.value.trim();
  elements.feedbackFormMessage.classList.remove("success");
  if (message.length < 3) {
    elements.feedbackFormMessage.textContent = t("feedbackMessageRequired");
    return;
  }
  setFormBusy(elements.feedbackForm, true);
  try {
    await RepairDeskCloud.submitFeedback(elements.feedbackTypeInput.value, message, activeView);
    elements.feedbackFormMessage.textContent = t("feedbackSent");
    elements.feedbackFormMessage.classList.add("success");
    elements.feedbackMessageInput.value = "";
    setTimeout(() => elements.feedbackDialog.close(), 700);
  } catch (error) {
    elements.feedbackFormMessage.textContent = error?.message || t("authGenericError");
  } finally {
    setFormBusy(elements.feedbackForm, false);
  }
}

async function submitRecovery(event) {
  event.preventDefault();
  const password = elements.recoveryPasswordInput.value;
  if (password.length < 8) {
    elements.recoveryMessage.textContent = t("authPasswordShort");
    return;
  }
  if (password !== elements.recoveryConfirmInput.value) {
    elements.recoveryMessage.textContent = t("authPasswordsMismatch");
    return;
  }
  setFormBusy(elements.recoveryForm, true);
  try {
    await RepairDeskCloud.updatePassword(password);
    elements.recoveryMessage.textContent = t("passwordUpdated");
    elements.recoveryMessage.classList.add("success");
    setTimeout(() => elements.recoveryDialog.close(), 900);
  } catch (error) {
    elements.recoveryMessage.textContent = error?.message || t("authGenericError");
  } finally {
    setFormBusy(elements.recoveryForm, false);
  }
}

function togglePasswordVisibility(button) {
  const input = document.getElementById(button.dataset.passwordTarget);
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
}

function adminViewRequested() {
  return new URLSearchParams(window.location.search).get("admin") === "1";
}

async function initialiseApplication() {
  window.RepairDeskV034?.init();
  initialiseTheme();
  refreshFormatters();
  applyTranslations();
  try {
    const result = await RepairDeskCloud.init(handleAuthStateChange);
    cloudConfigured = Boolean(result.configured);
    if (result.user) await completeCloudSignIn(result.user);
    else if (!settings.setupComplete) openSetup("language");
    else if (settings.setupVersion < SETUP_VERSION) openSetup("country");
    else if (cloudConfigured && (!localModeChosen || adminViewRequested())) openAuthDialog("signin");
    else continueLocally();
    if (new URLSearchParams(window.location.search).get("recovery") === "1" && result.user && !elements.recoveryDialog.open) elements.recoveryDialog.showModal();
  } catch {
    cloudConfigured = false;
    continueLocally();
    showToast(t("cloudNotConfigured"));
  }
  const startup = new URLSearchParams(window.location.search);
  const startupView = startup.get("view");
  if (settings.setupComplete && (cloudUser || localModeChosen || !cloudConfigured) && ["overview", "repairs", "customers", "devices", "inventory", "calendar", "reports", "settings"].includes(startupView)) showView(startupView);
  if (settings.setupComplete && (cloudUser || localModeChosen || !cloudConfigured) && startup.get("action") === "new-repair") {
    showView("repairs");
    setTimeout(openNewRepair, 0);
  }
}

elements.addRepairButton.addEventListener("click", openNewRepair);
elements.accountButton.addEventListener("click", openAccountDialog);
elements.mobileAccountButton.addEventListener("click", openAccountDialog);
elements.feedbackButton.addEventListener("click", openFeedbackDialog);
elements.mobileFeedbackButton.addEventListener("click", openFeedbackDialog);
elements.refreshAdminButton.addEventListener("click", () => renderAdminDashboard(true));
elements.exportAdminButton.addEventListener("click", exportAdminCsv);
elements.adminUsersMoreButton.addEventListener("click", () => loadAdminUserDirectory(false));
elements.adminUserSearch.addEventListener("input", () => {
  clearTimeout(adminUserSearchTimer);
  adminUserSearchTimer = setTimeout(() => loadAdminUserDirectory(true), 280);
});
elements.adminFeedbackFilter.addEventListener("change", () => renderAdminFeedback(Array.isArray(adminDashboard?.feedback) ? adminDashboard.feedback : []));
elements.adminFeedbackInbox.addEventListener("change", (event) => { if (event.target.matches("[data-feedback-status]")) changeFeedbackStatus(event.target); });
elements.closeAccountButton.addEventListener("click", () => elements.accountDialog.close());
elements.accountSignInButton.addEventListener("click", () => { elements.accountDialog.close(); openAuthDialog("signin"); });
elements.syncNowButton.addEventListener("click", () => performCloudSync({ notify: true }));
elements.signOutButton.addEventListener("click", signOutAccount);
elements.authSignInTab.addEventListener("click", () => setAuthMode("signin"));
elements.authSignUpTab.addEventListener("click", () => setAuthMode("signup"));
elements.authForm.addEventListener("submit", submitAuth);
elements.forgotPasswordButton.addEventListener("click", showResetRequest);
elements.localModeButton.addEventListener("click", continueLocally);
elements.resetBackButton.addEventListener("click", hideResetRequest);
elements.resetRequestForm.addEventListener("submit", submitResetRequest);
elements.confirmationBackButton.addEventListener("click", () => { elements.confirmationPanel.hidden = true; elements.authForm.hidden = false; document.querySelector(".auth-tabs").hidden = false; document.querySelector(".auth-links").hidden = false; setAuthMode("signin"); });
elements.mergeLocalDataButton.addEventListener("click", mergeLocalIntoCloud);
elements.useCloudDataButton.addEventListener("click", useCloudSnapshot);
elements.feedbackForm.addEventListener("submit", submitFeedback);
elements.closeFeedbackButton.addEventListener("click", () => elements.feedbackDialog.close());
elements.cancelFeedbackButton.addEventListener("click", () => elements.feedbackDialog.close());
elements.recoveryForm.addEventListener("submit", submitRecovery);
elements.setupDialog.addEventListener("cancel", (event) => { if (!settings.setupComplete) event.preventDefault(); });
elements.migrationDialog.addEventListener("cancel", (event) => event.preventDefault());
document.querySelectorAll("[data-password-target]").forEach((button) => button.addEventListener("click", () => togglePasswordVisibility(button)));
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
window.addEventListener("online", () => { if (cloudUser) scheduleCloudSync(100); updateCloudInterface(); });
window.addEventListener("offline", () => { if (cloudUser) setCloudState("offline"); });

initialiseApplication();
