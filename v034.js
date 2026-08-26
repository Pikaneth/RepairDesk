(() => {
  const VERSION = "0.3.4";
  const STANDARD_STATUSES = ["intake", "diagnosis", "approval", "waiting", "in-progress", "quality", "ready", "completed", "cancelled"];
  const OPEN_STATUSES = new Set(STANDARD_STATUSES.filter((status) => !["completed", "cancelled"].includes(status)));
  const state = {
    initialised: false,
    cloud: { workshopAccess: null, runtimeConfig: null },
    repairMode: "kanban",
    repairSearch: "",
    repairPriority: "all",
    repairAssignee: "all",
    savedFilterId: "",
    selectedRepairs: new Set(),
    detailRepairId: "",
    detailTab: "overview",
    entityKind: "",
    editingEntityId: "",
    inventoryTab: "stock",
    adminTab: "overview",
    adminRange: 30,
    adminFrom: "",
    adminTo: "",
    adminGranularity: "day",
    adminData: null,
    adminUsers: null,
    adminWorkshops: null,
    adminUserFilter: "all",
    adminUserQuery: "",
    adminLoading: false,
    adminDetail: null,
    pendingInstall: null,
    signatureDrawing: false,
    lastShortcut: "",
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const html = (value) => typeof escapeHtml === "function" ? escapeHtml(value) : String(value ?? "").replace(/[&<>"']/g, "");
  const tr = (key, variables = {}) => typeof t === "function" ? t(key, variables) : key;
  const workspace = () => {
    settings.workspace = normaliseWorkspaceData(settings.workspace);
    return settings.workspace;
  };
  const role = () => state.cloud.workshopAccess?.role || "owner";
  const canWrite = () => role() !== "viewer" && !runtimeRestriction();
  const canManage = () => ["owner", "manager"].includes(role());
  const nowIso = () => new Date().toISOString();
  const statusLabel = (status) => tr(status === "in-progress" ? "inProgress" : status);
  const priorityLabel = (priority) => tr({ low: "priorityLow", normal: "priorityNormal", high: "priorityHigh", urgent: "priorityUrgent" }[priority] || "priorityNormal");
  const arrayBy = (key) => workspace()[key] || [];
  const findCustomer = (id) => arrayBy("customers").find((item) => item.id === id);
  const findDevice = (id) => arrayBy("devices").find((item) => item.id === id);
  const teamMembers = () => state.cloud.workshopAccess?.members || [];
  const assigneeName = (id) => teamMembers().find((member) => member.user_id === id)?.display_name || teamMembers().find((member) => member.user_id === id)?.email || "";

  function compareVersions(left, right) {
    const a = String(left || "0").split(".").map((part) => Number(part) || 0);
    const b = String(right || "0").split(".").map((part) => Number(part) || 0);
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
      if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0);
    }
    return 0;
  }

  function runtimeRestriction() {
    if (cloudProfile?.is_admin) return "";
    const flags = state.cloud.runtimeConfig?.flags || {};
    if (flags.maintenance_mode?.enabled) return "maintenance";
    const minimum = flags.minimum_app_version;
    if (minimum?.enabled && minimum.value && compareVersions(VERSION, minimum.value) < 0) return "version";
    return "";
  }

  function flagEnabled(key) {
    const flag = state.cloud.runtimeConfig?.flags?.[key];
    if (!flag) return true;
    if (!flag.enabled) return false;
    const rollout = Math.min(100, Math.max(0, Number(flag.rollout_percent) || 0));
    if (rollout >= 100 || cloudProfile?.is_admin) return true;
    const seed = String(RepairDeskCloud?.deviceId?.() || "repairdesk");
    const bucket = [...seed].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 0) % 100;
    return bucket < rollout;
  }

  function persistWorkspace({ renderView = true } = {}) {
    markSettingsChanged();
    saveSettings();
    if (renderView) render(activeView);
  }

  function persistRepairs({ renderView = true } = {}) {
    repairs = repairs.map(normalizeRepair);
    saveRepairs();
    if (renderView) render(activeView);
  }

  function downloadFile(name, content, type = "application/json") {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function copyText(value) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(String(value));
    const input = document.createElement("textarea");
    input.value = String(value);
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
    return Promise.resolve();
  }

  function formValue(form, name) {
    return String(new FormData(form).get(name) || "").trim();
  }

  function icons(path) {
    const paths = {
      main: "M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z",
      repairs: "M8 3h8v3h3v15H5V6h3V3Zm2 3h4V5h-4v1Zm-2 5h8m-8 4h8",
      customers: "M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-1a3 3 0 1 0 0-6m-8 10c-4 0-6 2-6 6h12c0-4-2-6-6-6Zm8-1c3 0 5 2 5 6h-5",
      devices: "M7 2h10v20H7V2Zm3 3h4m-3 14h2",
      inventory: "m4 7 8-4 8 4-8 4-8-4Zm0 0v10l8 4 8-4V7M12 11v10",
      calendar: "M5 4h14v17H5V4Zm0 5h14M8 2v4m8-4v4",
      reports: "M4 20V10m5 10V4m5 16v-7m5 7V7",
      settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19 12l2-1-2-4-2 .5-2-1L14 4h-4L9 6.5l-2 1L5 7l-2 4 2 1v2l-2 1 2 4 2-.5 2 1L10 22h4l1-2.5 2-1 2 .5 2-4-2-1v-2Z",
      admin: "M4 19V9m5 10V5m5 14v-7m5 7V3",
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[path] || paths.main}" /></svg>`;
  }

  function injectNavigation() {
    const desktop = $(".sidebar .nav-list");
    const mobile = $(".mobile-nav");
    if (!desktop || $("[data-rd-v034-nav]", desktop)) return;
    desktop.innerHTML = `
      <button class="nav-item active" type="button" data-view-target="overview" data-rd-v034-nav>${icons("main")}<span data-i18n="main">Main</span></button>
      <button class="nav-item" type="button" data-view-target="repairs">${icons("repairs")}<span data-i18n="repairsBoard">Repairs</span></button>
      <button class="nav-item" type="button" data-view-target="customers">${icons("customers")}<span data-i18n="customers">Customers</span></button>
      <button class="nav-item" type="button" data-view-target="devices">${icons("devices")}<span data-i18n="devices">Devices</span></button>
      <button class="nav-item" type="button" data-view-target="inventory">${icons("inventory")}<span data-i18n="inventory">Inventory</span></button>
      <button class="nav-item" type="button" data-view-target="calendar">${icons("calendar")}<span data-i18n="calendar">Calendar</span></button>
      <button class="nav-item" type="button" data-view-target="reports">${icons("reports")}<span data-i18n="reports">Reports</span></button>
      <button class="nav-item" type="button" data-view-target="settings">${icons("settings")}<span data-i18n="settingsFull">Settings</span></button>
      <button class="nav-item owner-nav" id="adminNavButtonV034" type="button" data-view-target="admin" hidden>${icons("admin")}<span data-i18n="ownerPanel">Owner panel</span><i></i></button>`;
    if (mobile) mobile.innerHTML = `
      <button class="active" type="button" data-view-target="overview" data-i18n="main">Main</button>
      <button type="button" data-view-target="repairs" data-i18n="repairsBoard">Repairs</button>
      <button type="button" data-view-target="customers" data-i18n="customers">Customers</button>
      <button type="button" data-view-target="inventory" data-i18n="inventory">Inventory</button>
      <button id="adminMobileNavButtonV034" type="button" data-view-target="admin" data-i18n="ownerPanel" hidden>Owner</button>`;
  }

  function viewShell(view, eyebrow, title, copy, actions = "") {
    return `<section class="app-view rd-v034-view" id="${view}View" data-view="${view}" hidden>
      <header class="view-header rd-page-header"><div><p class="eyebrow"><span></span> <span>${html(eyebrow)}</span></p><h1>${html(title)}</h1><p>${html(copy)}</p></div><div class="rd-header-actions">${actions}</div></header>
      <div id="${view}Root"></div>
    </section>`;
  }

  function injectViews() {
    const admin = $("#adminView");
    if (!admin || $("#repairsView")) return;
    admin.insertAdjacentHTML("beforebegin",
      viewShell("repairs", tr("repairsBoard"), tr("repairsBoard"), tr("workflowSettingsCopy"), `<button class="primary-button" type="button" data-rd-action="new-repair">+ ${html(tr("quickIntake"))}</button>`) +
      viewShell("customers", tr("customerDirectory"), tr("customerDirectory"), tr("customerDirectoryCopy"), `<button class="primary-button" type="button" data-rd-action="add-customer">+ ${html(tr("addCustomer"))}</button>`) +
      viewShell("devices", tr("deviceRegistry"), tr("deviceRegistry"), tr("deviceRegistryCopy"), `<button class="primary-button" type="button" data-rd-action="add-device">+ ${html(tr("addDevice"))}</button>`) +
      viewShell("inventory", tr("inventory"), tr("inventory"), tr("lowStock"), `<button class="primary-button" type="button" data-rd-action="add-stock">+ ${html(tr("addStockItem"))}</button>`) +
      viewShell("calendar", tr("calendar"), tr("workshopCalendar"), tr("workshopCalendarCopy"), `<button class="primary-button" type="button" data-rd-action="add-appointment">+ ${html(tr("addAppointment"))}</button>`) +
      viewShell("reports", tr("reports"), tr("reports"), tr("revenueTrend"), `<select class="rd-compact-select" id="rdReportPeriod"><option value="30">30</option><option value="90">90</option><option value="365">365</option></select>`));
  }

  function injectDashboard() {
    const overview = $("#overviewView");
    if (!overview || $("#rdTodayDashboard")) return;
    const hero = $(".hero", overview);
    hero?.insertAdjacentHTML("afterend", `<section id="rdTodayDashboard" class="rd-today-dashboard"></section>`);
  }

  function injectIntakeFields() {
    const body = $("#repairDialog .dialog-body");
    const parts = $("#repairDialog .parts-editor");
    if (!body || !parts || $("#rdIntakeFields")) return;
    parts.insertAdjacentHTML("beforebegin", `<section class="form-section rd-intake-fields" id="rdIntakeFields">
      <div class="parts-heading"><div><h3 data-i18n="quickIntake">Quick intake</h3><p data-i18n="autosaveOn">Autosave is on</p></div><span class="rd-autosave-state" id="rdAutosaveState">●</span></div>
      <div class="form-grid">
        <label class="field"><span data-i18n="priority">Priority</span><select id="rdPriorityInput"><option value="low" data-i18n="priorityLow">Low</option><option value="normal" data-i18n="priorityNormal">Normal</option><option value="high" data-i18n="priorityHigh">High</option><option value="urgent" data-i18n="priorityUrgent">Urgent</option></select></label>
        <label class="field"><span data-i18n="assignee">Assignee</span><select id="rdAssigneeInput"><option value="" data-i18n="allAssignees">Unassigned</option></select></label>
        <label class="field"><span data-i18n="imei">IMEI</span><input id="rdImeiInput" maxlength="40" inputmode="numeric" /></label>
        <label class="field"><span data-i18n="tags">Tags</span><input id="rdTagsInput" maxlength="240" data-i18n-placeholder="tagsPlaceholder" /></label>
        <label class="field field-wide"><span data-i18n="deviceCondition">Condition at intake</span><textarea id="rdConditionInput" rows="2" maxlength="1000"></textarea></label>
        <label class="field field-wide"><span data-i18n="accessories">Accessories received</span><input id="rdAccessoriesInput" maxlength="500" /></label>
        <label class="field"><span data-i18n="accessCode">Device access code</span><input id="rdAccessCodeInput" type="password" maxlength="100" autocomplete="off" /><small data-i18n="accessCodeHint">Visible only inside the workshop.</small></label>
        <label class="field"><span data-i18n="warrantyUntil">Warranty until</span><input id="rdWarrantyInput" type="date" /></label>
        <label class="field field-wide rd-consent"><input id="rdIntakeAcceptedInput" type="checkbox" /> <span data-i18n="intakeConsent">Customer confirmed the intake condition</span></label>
      </div>
      <div class="rd-signature-wrap"><div><strong data-i18n="intakeSignature">Customer signature</strong><button class="text-button" id="rdClearSignature" type="button" data-i18n="clearSignature">Clear signature</button></div><canvas id="rdSignatureCanvas" width="720" height="160"></canvas></div>
    </section>`);
    STANDARD_STATUSES.forEach((status) => {
      if (!$(`#statusInput option[value="${status}"]`)) $("#statusInput")?.insertAdjacentHTML("beforeend", `<option value="${status}">${html(statusLabel(status))}</option>`);
      if (!$(`#statusFilter option[value="${status}"]`)) $("#statusFilter")?.insertAdjacentHTML("beforeend", `<option value="${status}">${html(statusLabel(status))}</option>`);
    });
  }

  function injectSettingsExtensions() {
    const form = $("#settingsForm");
    if (!form || $("#rdSettingsExtensions")) return;
    form.insertAdjacentHTML("afterend", `<div class="settings-form rd-settings-extensions" id="rdSettingsExtensions">
      <section class="settings-card" id="rdTeamSettings"></section>
      <section class="settings-card" id="rdWorkflowSettings"></section>
      <section class="settings-card" id="rdDocumentSettings"></section>
      <section class="settings-card" id="rdDataSettings"></section>
      <section class="settings-card" id="rdInstallSettings"></section>
    </div>`);
  }

  function injectDialogs() {
    if ($("#rdDetailDialog")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <dialog class="rd-detail-dialog" id="rdDetailDialog"><div class="rd-detail-shell"><header id="rdDetailHeader"></header><nav class="rd-detail-tabs" id="rdDetailTabs"></nav><div class="rd-detail-body" id="rdDetailBody"></div></div></dialog>
      <dialog class="rd-entity-dialog" id="rdEntityDialog"><form id="rdEntityForm" class="rd-entity-shell"><header><div><p class="eyebrow"><span></span> <span id="rdEntityEyebrow"></span></p><h2 id="rdEntityTitle"></h2></div><button type="button" class="icon-button" data-rd-action="close-entity">×</button></header><div class="rd-entity-fields" id="rdEntityFields"></div><footer><button class="secondary-button" type="button" data-rd-action="close-entity" data-i18n="cancel">Cancel</button><button class="primary-button" type="submit" data-i18n="saveSettings">Save</button></footer></form></dialog>
      <dialog class="rd-admin-user-dialog" id="rdAdminUserDialog"><div class="rd-admin-user-shell"><header><div><p class="eyebrow"><span></span> <span data-i18n="ownerUsers">Users</span></p><h2 id="rdAdminUserTitle"></h2></div><button type="button" class="icon-button" data-rd-action="close-admin-user">×</button></header><div id="rdAdminUserBody"></div></div></dialog>
      <section class="rd-portal-screen" id="rdPortalScreen" hidden><div class="rd-portal-card"><div class="setup-brand"><span class="brand-mark">↳</span><span>RepairDesk</span></div><div id="rdPortalBody"></div></div></section>`);
  }

  function injectAdmin() {
    const admin = $("#adminView");
    if (!admin || $("#rdAdminRoot")) return;
    [...admin.children].forEach((child) => child.classList.add("rd-legacy-admin"));
    admin.insertAdjacentHTML("beforeend", `<div id="rdAdminRoot" class="rd-admin-root">
      <header class="view-header rd-page-header"><div><p class="eyebrow"><span></span> <span data-i18n="ownerPanel">Owner panel</span></p><h1 data-i18n="ownerConsole">Owner console</h1><p data-i18n="ownerConsoleCopy">Everything important in one private control centre.</p></div><div class="rd-header-actions"><button class="secondary-button" type="button" data-rd-action="admin-export" data-i18n="exportCsv">Export CSV</button><button class="secondary-button" type="button" data-rd-action="admin-refresh" data-i18n="refreshAnalytics">Refresh</button></div></header>
      <div class="rd-admin-toolbar"><nav id="rdAdminTabs"></nav><div class="rd-admin-range"><select id="rdAdminRange"><option value="7" data-i18n="last7Days">Last 7 days</option><option value="30" selected data-i18n="last30Days">Last 30 days</option><option value="90" data-i18n="last90Days">Last 90 days</option><option value="custom" data-i18n="customRange">Custom</option></select><input id="rdAdminFrom" type="date" hidden /><input id="rdAdminTo" type="date" hidden /></div></div>
      <p class="admin-status" id="rdAdminStatus" role="status"></p><div id="rdAdminContent"></div>
    </div>`);
  }

  function renderTodayDashboard() {
    const root = $("#rdTodayDashboard");
    if (!root) return;
    const today = new Date().toISOString().slice(0, 10);
    const overdue = repairs.filter((repair) => OPEN_STATUSES.has(repair.status) && repair.target && repair.target < today).length;
    const dueToday = repairs.filter((repair) => OPEN_STATUSES.has(repair.status) && repair.target === today).length;
    const approval = repairs.filter((repair) => repair.status === "approval").length;
    const ready = repairs.filter((repair) => repair.status === "ready").length;
    const revenue = repairs.flatMap((repair) => repair.payments || []).filter((payment) => String(payment.paidAt || payment.createdAt || "").slice(0, 10) === today && payment.status !== "refunded").reduce((sum, payment) => sum + toAmount(payment.amount), 0);
    const low = arrayBy("inventory").filter((item) => Number(item.quantity) <= Number(item.minimumQuantity || 0)).length;
    root.innerHTML = `<div class="rd-today-head"><div><p class="eyebrow"><span></span> <span>${html(tr("today"))}</span></p><h2>${html(tr("activityToday"))}</h2></div><div class="rd-quick-actions"><button class="primary-button" data-rd-action="new-repair">+ ${html(tr("quickIntake"))}</button><button class="secondary-button" data-rd-action="add-customer">+ ${html(tr("addCustomer"))}</button><button class="secondary-button" data-rd-action="add-appointment">+ ${html(tr("addAppointment"))}</button></div></div>
      <div class="rd-today-grid">
        ${metric(tr("today"), dueToday, tr("repairsBoard"), "neutral", "repairs")}
        ${metric(tr("overdue"), overdue, tr("needsAttention"), overdue ? "danger" : "neutral", "repairs")}
        ${metric(tr("awaitingApproval"), approval, tr("estimate"), "warning", "repairs")}
        ${metric(tr("readyForPickup"), ready, tr("ready"), "success", "repairs")}
        ${metric(tr("revenueToday"), formatMoney(revenue), tr("paid"), "accent", "reports")}
        ${metric(tr("lowStock"), low, tr("inventory"), low ? "warning" : "neutral", "inventory")}
      </div>`;
  }

  function metric(label, value, hint, tone, target) {
    return `<button class="rd-metric ${tone}" data-view-target="${target}"><span>${html(label)}</span><strong>${html(value)}</strong><small>${html(hint)}</small></button>`;
  }

  function filteredBoardRepairs() {
    const query = state.repairSearch.toLocaleLowerCase(currentLocale());
    return repairs.filter((repair) => {
      const text = [repair.device, repair.issue, repair.serial, repair.imei, repair.customer?.name, repair.customer?.phone, ...(repair.tags || [])].join(" ").toLocaleLowerCase(currentLocale());
      return (!query || text.includes(query)) && (state.repairPriority === "all" || repair.priority === state.repairPriority) && (state.repairAssignee === "all" || repair.assignedTo === state.repairAssignee);
    });
  }

  function repairCard(repair, compact = false) {
    const customer = repair.customer?.name || findCustomer(repair.customerId)?.name || tr("customerName");
    const overdue = repair.target && OPEN_STATUSES.has(repair.status) && repair.target < new Date().toISOString().slice(0, 10);
    const tags = (repair.tags || []).slice(0, 3).map((tag) => `<i>${html(tag)}</i>`).join("");
    return `<article class="rd-kanban-card priority-${repair.priority}${overdue ? " overdue" : ""}" draggable="${canWrite()}" data-repair-id="${html(repair.id)}">
      <div class="rd-card-select"><input type="checkbox" data-rd-select-repair="${html(repair.id)}" ${state.selectedRepairs.has(repair.id) ? "checked" : ""} aria-label="${html(tr("selectedCount", { count: 1 }))}" /><span class="rd-priority-dot"></span></div>
      <button class="rd-card-main" type="button" data-rd-action="open-repair" data-repair-id="${html(repair.id)}"><strong>${html(repair.device)}</strong><span>${html(getIssue(repair))}</span><small>${html(customer)}${repair.target ? ` · ${html(formatDate(repair.target))}` : ""}</small>${compact ? "" : `<em>${html(formatMoney(getRepairTotal(repair)))}</em>`}</button>
      <div class="rd-card-foot"><span class="rd-tags">${tags}</span><span title="${html(assigneeName(repair.assignedTo) || tr("allAssignees"))}">${html((assigneeName(repair.assignedTo) || "—").slice(0, 2).toUpperCase())}</span></div>
    </article>`;
  }

  function renderRepairs() {
    const root = $("#repairsRoot");
    if (!root) return;
    const rows = filteredBoardRepairs();
    const members = teamMembers().filter((member) => member.status === "active");
    const savedFilters = arrayBy("savedFilters");
    const custom = arrayBy("customStatuses").map((item) => item.key).filter(Boolean);
    const statuses = [...new Set([...STANDARD_STATUSES, ...custom])];
    root.innerHTML = `<section class="rd-board-toolbar">
      <label class="search-field"><span class="sr-only">${html(tr("searchRepairs"))}</span>${icons("main")}<input id="rdRepairSearch" type="search" value="${html(state.repairSearch)}" placeholder="${html(tr("searchPlaceholder"))}" /></label>
      <select id="rdRepairPriority"><option value="all">${html(tr("allPriorities"))}</option>${["low", "normal", "high", "urgent"].map((value) => `<option value="${value}" ${state.repairPriority === value ? "selected" : ""}>${html(priorityLabel(value))}</option>`).join("")}</select>
      <select id="rdRepairAssignee"><option value="all">${html(tr("allAssignees"))}</option>${members.map((member) => `<option value="${html(member.user_id)}" ${state.repairAssignee === member.user_id ? "selected" : ""}>${html(member.display_name || member.email)}</option>`).join("")}</select>
      <select id="rdSavedFilter"><option value="">${html(tr("savedFilters"))}</option>${savedFilters.map((filter) => `<option value="${html(filter.id)}" ${state.savedFilterId === filter.id ? "selected" : ""}>${html(filter.name)}</option>`).join("")}</select>
      <button class="secondary-button" data-rd-action="save-filter">${html(tr("saveCurrentFilter"))}</button>${state.savedFilterId ? `<button class="text-button" data-rd-action="remove-filter" data-id="${html(state.savedFilterId)}" aria-label="${html(tr("deleteFilter"))}">×</button>` : ""}
      <div class="rd-segment"><button class="${state.repairMode === "kanban" ? "active" : ""}" data-rd-mode="kanban">${html(tr("kanban"))}</button><button class="${state.repairMode === "list" ? "active" : ""}" data-rd-mode="list">${html(tr("list"))}</button></div>
    </section>
    ${state.selectedRepairs.size ? `<section class="rd-bulk-bar"><strong>${html(tr("selectedCount", { count: state.selectedRepairs.size }))}</strong><select id="rdBulkStatus"><option value="">${html(tr("changeStatus"))}</option>${statuses.map((value) => `<option value="${html(value)}">${html(statusLabel(value))}</option>`).join("")}</select><select id="rdBulkAssignee"><option value="">${html(tr("assign"))}</option>${members.map((member) => `<option value="${html(member.user_id)}">${html(member.display_name || member.email)}</option>`).join("")}</select><button class="danger-button" data-rd-action="bulk-delete">${html(tr("deleteSelected"))}</button></section>` : ""}
    ${state.repairMode === "kanban" ? `<div class="rd-kanban">${statuses.filter((status) => status !== "cancelled" || rows.some((row) => row.status === status)).map((status) => {
      const cards = rows.filter((repair) => repair.status === status);
      return `<section class="rd-kanban-column" data-drop-status="${html(status)}"><header><span class="status-badge ${html(status)}">${html(statusLabel(status))}</span><strong>${cards.length}</strong></header><div>${cards.map((repair) => repairCard(repair)).join("") || `<p class="rd-column-empty">${html(tr("noItems"))}</p>`}</div></section>`;
    }).join("")}</div>` : renderRepairTable(rows)}`;
  }

  function renderRepairTable(rows) {
    return `<div class="rd-table-shell"><table class="rd-table"><thead><tr><th></th><th>${html(tr("deviceModel"))}</th><th>${html(tr("customerNameLabel"))}</th><th>${html(tr("status"))}</th><th>${html(tr("priority"))}</th><th>${html(tr("assignee"))}</th><th>${html(tr("targetDate"))}</th><th>${html(tr("repairTotal"))}</th></tr></thead><tbody>${rows.map((repair) => `<tr data-repair-id="${html(repair.id)}"><td><input type="checkbox" data-rd-select-repair="${html(repair.id)}" ${state.selectedRepairs.has(repair.id) ? "checked" : ""} /></td><td><button class="rd-table-link" data-rd-action="open-repair" data-repair-id="${html(repair.id)}"><strong>${html(repair.device)}</strong><span>${html(getIssue(repair))}</span></button></td><td>${html(repair.customer?.name || findCustomer(repair.customerId)?.name || "—")}</td><td><span class="status-badge ${html(repair.status)}">${html(statusLabel(repair.status))}</span></td><td>${html(priorityLabel(repair.priority))}</td><td>${html(assigneeName(repair.assignedTo) || "—")}</td><td>${html(formatDate(repair.target))}</td><td>${html(formatMoney(getRepairTotal(repair)))}</td></tr>`).join("") || `<tr><td colspan="8">${html(tr("searchNoResults"))}</td></tr>`}</tbody></table></div>`;
  }

  function renderCustomers() {
    const root = $("#customersRoot");
    if (!root) return;
    const customers = arrayBy("customers");
    root.innerHTML = `<div class="rd-record-grid">${customers.map((customer) => {
      const related = repairs.filter((repair) => repair.customerId === customer.id || (!repair.customerId && repair.customer?.email && repair.customer.email === customer.email));
      const value = related.reduce((sum, repair) => sum + getRepairTotal(repair), 0);
      return `<article class="rd-record-card" data-entity-id="${html(customer.id)}"><header><span class="rd-avatar">${html((customer.name || "?").charAt(0).toUpperCase())}</span><div><h3>${html(customer.name || "—")}</h3><p>${html(customer.phone || customer.email || "—")}</p></div></header><dl><div><dt>${html(tr("customerRepairs"))}</dt><dd>${related.length}</dd></div><div><dt>${html(tr("lifetimeValue"))}</dt><dd>${html(formatMoney(value))}</dd></div></dl><p>${html(customer.notes || customer.address || "")}</p><footer><button class="secondary-button" data-rd-action="edit-customer" data-id="${html(customer.id)}">${html(tr("edit"))}</button><button class="text-button" data-rd-action="customer-repair" data-id="${html(customer.id)}">+ ${html(tr("newRepair"))}</button></footer></article>`;
    }).join("") || `<div class="empty-state"><h3>${html(tr("noItems"))}</h3><button class="primary-button" data-rd-action="add-customer">${html(tr("addCustomer"))}</button></div>`}</div>`;
  }

  function renderDevices() {
    const root = $("#devicesRoot");
    if (!root) return;
    const devices = arrayBy("devices");
    root.innerHTML = `<div class="rd-table-shell"><table class="rd-table"><thead><tr><th>${html(tr("deviceModel"))}</th><th>${html(tr("ownerCustomer"))}</th><th>${html(tr("serialNumber"))}</th><th>${html(tr("imei"))}</th><th>${html(tr("warrantyUntil"))}</th><th>${html(tr("repairHistory"))}</th><th></th></tr></thead><tbody>${devices.map((device) => {
      const history = repairs.filter((repair) => repair.deviceId === device.id).length;
      return `<tr><td><strong>${html([device.brand, device.model].filter(Boolean).join(" ") || "—")}</strong><span class="rd-cell-meta">${html(statusLabel(device.category || "other"))}</span></td><td>${html(findCustomer(device.customerId)?.name || "—")}</td><td>${html(device.serial || "—")}</td><td>${html(device.imei || "—")}</td><td>${html(formatDate(device.warrantyUntil))}</td><td>${history}</td><td><button class="text-button" data-rd-action="edit-device" data-id="${html(device.id)}">${html(tr("edit"))}</button></td></tr>`;
    }).join("") || `<tr><td colspan="7">${html(tr("noItems"))}</td></tr>`}</tbody></table></div>`;
  }

  function renderInventory() {
    const root = $("#inventoryRoot");
    if (!root) return;
    const stock = arrayBy("inventory");
    const suppliers = arrayBy("suppliers");
    const orders = arrayBy("purchaseOrders");
    const stockCost = stock.reduce((sum, item) => sum + toAmount(item.cost) * Number(item.quantity || 0), 0);
    const stockRevenue = stock.reduce((sum, item) => sum + toAmount(item.price) * Number(item.quantity || 0), 0);
    root.innerHTML = `<div class="rd-summary-strip">${metric(tr("stockValue"), formatMoney(stockCost), `${stock.length} ${tr("stock").toLowerCase()}`, "neutral", "inventory")}${metric(tr("potentialRevenue"), formatMoney(stockRevenue), tr("salePrice"), "accent", "inventory")}${metric(tr("lowStock"), stock.filter((item) => Number(item.quantity) <= Number(item.minimumQuantity || 0)).length, tr("needsAttention"), "warning", "inventory")}</div>
      <nav class="rd-subtabs"><button class="${state.inventoryTab === "stock" ? "active" : ""}" data-inventory-tab="stock">${html(tr("stock"))}</button><button class="${state.inventoryTab === "suppliers" ? "active" : ""}" data-inventory-tab="suppliers">${html(tr("suppliers"))}</button><button class="${state.inventoryTab === "orders" ? "active" : ""}" data-inventory-tab="orders">${html(tr("purchaseOrders"))}</button></nav>
      <div class="rd-subtab-actions">${state.inventoryTab === "stock" ? `<button class="primary-button" data-rd-action="add-stock">+ ${html(tr("addStockItem"))}</button>` : state.inventoryTab === "suppliers" ? `<button class="primary-button" data-rd-action="add-supplier">+ ${html(tr("addSupplier"))}</button>` : `<button class="primary-button" data-rd-action="add-order">+ ${html(tr("addPurchaseOrder"))}</button>`}</div>
      ${state.inventoryTab === "stock" ? renderStockTable(stock) : state.inventoryTab === "suppliers" ? renderSupplierCards(suppliers) : renderOrderTable(orders)}`;
  }

  function renderStockTable(stock) {
    return `<div class="rd-table-shell"><table class="rd-table"><thead><tr><th>${html(tr("sku"))}</th><th>${html(tr("partName"))}</th><th>${html(tr("quantity"))}</th><th>${html(tr("compatibility"))}</th><th>${html(tr("supplier"))}</th><th>${html(tr("purchaseCost"))}</th><th>${html(tr("salePrice"))}</th><th></th></tr></thead><tbody>${stock.map((item) => `<tr class="${Number(item.quantity) <= Number(item.minimumQuantity || 0) ? "rd-low-stock" : ""}"><td>${html(item.sku || "—")}</td><td><strong>${html(item.name)}</strong><span class="rd-cell-meta">${html(item.location || "")}</span></td><td><strong>${html(item.quantity || 0)}</strong><span class="rd-cell-meta">min ${html(item.minimumQuantity || 0)}</span></td><td>${html(item.compatibleModels || "—")}</td><td>${html(arrayBy("suppliers").find((supplier) => supplier.id === item.supplierId)?.name || "—")}</td><td>${html(formatMoney(item.cost))}</td><td>${html(formatMoney(item.price))}</td><td><button class="text-button" data-rd-action="edit-stock" data-id="${html(item.id)}">${html(tr("edit"))}</button></td></tr>`).join("") || `<tr><td colspan="8">${html(tr("noItems"))}</td></tr>`}</tbody></table></div>`;
  }

  function renderSupplierCards(suppliers) {
    return `<div class="rd-record-grid">${suppliers.map((supplier) => `<article class="rd-record-card"><header><span class="rd-avatar">${html((supplier.name || "?")[0])}</span><div><h3>${html(supplier.name)}</h3><p>${html(supplier.contactName || supplier.email || "—")}</p></div></header><p>${html([supplier.phone, supplier.website].filter(Boolean).join(" · "))}</p><footer><button class="secondary-button" data-rd-action="edit-supplier" data-id="${html(supplier.id)}">${html(tr("edit"))}</button></footer></article>`).join("") || `<p>${html(tr("noItems"))}</p>`}</div>`;
  }

  function renderOrderTable(orders) {
    return `<div class="rd-table-shell"><table class="rd-table"><thead><tr><th>${html(tr("orderNumber"))}</th><th>${html(tr("supplier"))}</th><th>${html(tr("orderStatus"))}</th><th>${html(tr("trackingNumber"))}</th><th>${html(tr("expenses"))}</th><th></th></tr></thead><tbody>${orders.map((order) => `<tr><td><strong>${html(order.number || "—")}</strong><span class="rd-cell-meta">${html(formatDate(order.orderedOn))}</span></td><td>${html(arrayBy("suppliers").find((supplier) => supplier.id === order.supplierId)?.name || "—")}</td><td><span class="status-badge ${html(order.status)}">${html(tr(order.status === "received" ? "receivedStatus" : order.status))}</span></td><td>${html(order.tracking || "—")}</td><td>${html(formatMoney(order.total))}</td><td>${order.status !== "received" ? `<button class="text-button" data-rd-action="receive-order" data-id="${html(order.id)}">${html(tr("receiveIntoStock"))}</button>` : ""}<button class="text-button" data-rd-action="edit-order" data-id="${html(order.id)}">${html(tr("edit"))}</button></td></tr>`).join("") || `<tr><td colspan="6">${html(tr("noItems"))}</td></tr>`}</tbody></table></div>`;
  }

  function renderCalendar() {
    const root = $("#calendarRoot");
    if (!root) return;
    const events = [
      ...arrayBy("appointments").map((item) => ({ ...item, kind: "appointment", date: String(item.startsAt || "").slice(0, 10) })),
      ...repairs.filter((repair) => repair.target && OPEN_STATUSES.has(repair.status)).map((repair) => ({ id: `repair-${repair.id}`, repairId: repair.id, title: repair.device, startsAt: `${repair.target}T12:00`, date: repair.target, kind: "deadline", status: repair.status })),
    ].sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
    const grouped = Map.groupBy ? Map.groupBy(events, (item) => item.date) : events.reduce((map, item) => map.set(item.date, [...(map.get(item.date) || []), item]), new Map());
    root.innerHTML = `<div class="rd-calendar-layout"><aside class="rd-mini-calendar">${renderMonth()}</aside><section class="rd-agenda">${[...grouped.entries()].map(([date, items]) => `<article><header><strong>${html(formatDate(date))}</strong><span>${items.length}</span></header>${items.map((item) => `<button class="rd-agenda-item ${item.kind}" data-rd-action="${item.kind === "deadline" ? "open-repair" : "edit-appointment"}" data-repair-id="${html(item.repairId || "")}" data-id="${html(item.id)}"><i></i><div><strong>${html(item.title || tr("addAppointment"))}</strong><span>${html(item.kind === "deadline" ? statusLabel(item.status) : new Intl.DateTimeFormat(currentLocale(), { hour: "2-digit", minute: "2-digit" }).format(new Date(item.startsAt)))}</span></div></button>`).join("")}</article>`).join("") || `<p>${html(tr("noItems"))}</p>`}</section></div>`;
  }

  function renderMonth() {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth();
    const first = new Date(year, month, 1);
    const start = (first.getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    const marked = new Set([...arrayBy("appointments").map((item) => String(item.startsAt).slice(0, 10)), ...repairs.map((repair) => repair.target).filter(Boolean)]);
    const cells = Array.from({ length: start }, () => "<i></i>").concat(Array.from({ length: days }, (_, index) => {
      const day = index + 1;
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return `<span class="${key === new Date().toISOString().slice(0, 10) ? "today" : ""}${marked.has(key) ? " marked" : ""}">${day}</span>`;
    }));
    return `<h3>${html(new Intl.DateTimeFormat(currentLocale(), { month: "long", year: "numeric" }).format(date))}</h3><div class="rd-month-week">${["M", "T", "W", "T", "F", "S", "S"].map((day) => `<b>${day}</b>`).join("")}</div><div class="rd-month-grid">${cells.join("")}</div>`;
  }

  function renderReports() {
    const root = $("#reportsRoot");
    if (!root) return;
    const period = Number($("#rdReportPeriod")?.value || 30);
    const from = new Date(Date.now() - (period - 1) * 86400000);
    const rows = repairs.filter((repair) => new Date(repair.createdAt) >= from);
    const paid = rows.flatMap((repair) => repair.payments || []).filter((payment) => payment.status !== "refunded").reduce((sum, payment) => sum + toAmount(payment.amount), 0);
    const value = rows.reduce((sum, repair) => sum + getRepairTotal(repair), 0);
    const cost = rows.reduce((sum, repair) => sum + repair.parts.reduce((partSum, part) => partSum + toAmount(part.cost) * Number(part.quantity || 1), 0), 0);
    const completed = rows.filter((repair) => repair.status === "completed").length;
    const statuses = countBy(rows, (repair) => repair.status);
    const categories = countBy(rows, (repair) => repair.category);
    const technicians = countBy(rows.filter((repair) => repair.assignedTo), (repair) => assigneeName(repair.assignedTo) || repair.assignedTo);
    root.innerHTML = `<div class="rd-report-grid">${metric(tr("revenue"), formatMoney(paid), tr("paid"), "accent", "reports")}${metric(tr("repairValue"), formatMoney(value), `${rows.length} ${tr("repairs").toLowerCase()}`, "neutral", "reports")}${metric(tr("profit"), formatMoney(Math.max(0, paid - cost)), tr("purchaseCost"), "success", "reports")}${metric(tr("averageTicket"), formatMoney(rows.length ? value / rows.length : 0), tr("repairTotal"), "neutral", "reports")}${metric(tr("completedRepairs"), completed, tr("completed"), "success", "reports")}</div>
      <div class="rd-report-panels"><section class="settings-card"><h2>${html(tr("statusDistribution"))}</h2>${breakdown(statuses)}</section><section class="settings-card"><h2>${html(tr("categoryDistribution"))}</h2>${breakdown(categories, (key) => tr(key))}</section><section class="settings-card"><h2>${html(tr("technicianPerformance"))}</h2>${breakdown(technicians)}</section><section class="settings-card rd-revenue-chart"><h2>${html(tr("revenueTrend"))}</h2>${localRevenueChart(rows, period)}</section></div>`;
  }

  function countBy(rows, getter) {
    return [...rows.reduce((map, row) => { const key = getter(row) || "—"; map.set(key, (map.get(key) || 0) + 1); return map; }, new Map()).entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }

  function breakdown(rows, formatter = (value) => value) {
    const max = Math.max(1, ...rows.map((row) => row.count));
    return `<div class="rd-breakdown">${rows.map((row) => `<div><span>${html(formatter(row.name))}</span><i><b style="width:${row.count / max * 100}%"></b></i><strong>${row.count}</strong></div>`).join("") || `<p>${html(tr("noItems"))}</p>`}</div>`;
  }

  function localRevenueChart(rows, period) {
    const days = Math.min(period, 90);
    const values = Array.from({ length: days }, (_, index) => {
      const date = new Date(Date.now() - (days - index - 1) * 86400000).toISOString().slice(0, 10);
      const amount = rows.filter((repair) => String(repair.createdAt).slice(0, 10) === date).reduce((sum, repair) => sum + getRepairTotal(repair), 0);
      return { date, amount };
    });
    const max = Math.max(1, ...values.map((item) => item.amount));
    return `<div class="rd-local-chart">${values.map((item) => `<i style="height:${Math.max(item.amount ? 3 : 0, item.amount / max * 100)}%" title="${html(formatDate(item.date))}: ${html(formatMoney(item.amount))}"></i>`).join("")}</div>`;
  }

  function render(view = activeView) {
    if (!state.initialised) return;
    renderTodayDashboard();
    if (view === "repairs") renderRepairs();
    if (view === "customers") renderCustomers();
    if (view === "devices") renderDevices();
    if (view === "inventory") renderInventory();
    if (view === "calendar") renderCalendar();
    if (view === "reports") renderReports();
    if (view === "settings") renderSettings();
    if (view === "admin") renderAdmin();
    updateOfflineState();
  }

  window.RepairDeskV034 = {
    handlesAdmin: true,
    canWrite,
    init,
    render,
    translate,
    showView,
    setCloudContext,
    updateAccount,
    prepareRepairForm,
    readRepairFields,
    afterRepairSaved,
    afterRepairDeleted,
  };

  function entityFields(kind, item = {}, prefill = {}) {
    const value = (key) => html(item[key] ?? prefill[key] ?? "");
    const customerOptions = `<option value="">—</option>${arrayBy("customers").map((customer) => `<option value="${html(customer.id)}" ${String(item.customerId || prefill.customerId) === customer.id ? "selected" : ""}>${html(customer.name)}</option>`).join("")}`;
    const supplierOptions = `<option value="">—</option>${arrayBy("suppliers").map((supplier) => `<option value="${html(supplier.id)}" ${String(item.supplierId || prefill.supplierId) === supplier.id ? "selected" : ""}>${html(supplier.name)}</option>`).join("")}`;
    if (kind === "customer") return `
      ${field("name", tr("customerNameLabel"), value("name"), "text", true)}${field("phone", tr("phoneLabel"), value("phone"), "tel")}${field("email", tr("emailLabel"), value("email"), "email")}${field("address", tr("addressLabel"), value("address"))}${textareaField("notes", tr("customerNotes"), value("notes"), 3, true)}`;
    if (kind === "device") return `
      ${field("brand", tr("brand"), value("brand"), "text", true)}${field("model", tr("model"), value("model"), "text", true)}<label class="field"><span>${html(tr("ownerCustomer"))}</span><select name="customerId">${customerOptions}</select></label>${field("serial", tr("serialNumber"), value("serial"))}${field("imei", tr("imei"), value("imei"))}${field("warrantyUntil", tr("warrantyUntil"), value("warrantyUntil"), "date")}${textareaField("notes", tr("customerNotes"), value("notes"), 2, true)}`;
    if (kind === "stock") return `
      ${field("name", tr("partName"), value("name"), "text", true)}${field("sku", tr("sku"), value("sku"))}${field("category", tr("category"), value("category"))}${field("quantity", tr("quantity"), value("quantity") || "0", "number")}${field("minimumQuantity", tr("minimumStock"), value("minimumQuantity") || "0", "number")}${field("cost", tr("purchaseCost"), value("cost") || "0", "number")}${field("price", tr("salePrice"), value("price") || "0", "number")}${field("compatibleModels", tr("compatibility"), value("compatibleModels"))}${field("location", tr("location"), value("location"))}<label class="field"><span>${html(tr("supplier"))}</span><select name="supplierId">${supplierOptions}</select></label>`;
    if (kind === "supplier") return `
      ${field("name", tr("supplier"), value("name"), "text", true)}${field("contactName", tr("contactPerson"), value("contactName"))}${field("email", tr("emailLabel"), value("email"), "email")}${field("phone", tr("phoneLabel"), value("phone"), "tel")}${field("website", tr("website"), value("website"), "url")}${textareaField("notes", tr("customerNotes"), value("notes"), 3, true)}`;
    if (kind === "order") return `
      ${field("number", tr("orderNumber"), value("number") || `PO-${Date.now().toString().slice(-6)}`, "text", true)}<label class="field"><span>${html(tr("supplier"))}</span><select name="supplierId" required>${supplierOptions}</select></label><label class="field"><span>${html(tr("orderStatus"))}</span><select name="status"><option value="ordered" ${item.status === "ordered" ? "selected" : ""}>${html(tr("ordered"))}</option><option value="shipped" ${item.status === "shipped" ? "selected" : ""}>${html(tr("shipped"))}</option><option value="received" ${item.status === "received" ? "selected" : ""}>${html(tr("receivedStatus"))}</option></select></label>${field("tracking", tr("trackingNumber"), value("tracking"))}${field("orderedOn", tr("receivedDate"), value("orderedOn") || new Date().toISOString().slice(0, 10), "date")}${field("itemName", tr("partName"), value("itemName"))}${field("sku", tr("sku"), value("sku"))}${field("quantity", tr("quantity"), value("quantity") || "1", "number")}${field("unitCost", tr("purchaseCost"), value("unitCost") || "0", "number")}`;
    if (kind === "appointment") return `
      ${field("title", tr("appointmentTitle"), value("title"), "text", true)}${field("startsAt", tr("startsAt"), localDateTime(value("startsAt")), "datetime-local", true)}${field("endsAt", tr("endsAt"), localDateTime(value("endsAt")), "datetime-local")}<label class="field"><span>${html(tr("ownerCustomer"))}</span><select name="customerId">${customerOptions}</select></label><label class="field"><span>${html(tr("status"))}</span><select name="status"><option value="scheduled" ${item.status === "scheduled" ? "selected" : ""}>${html(tr("scheduled"))}</option><option value="completed" ${item.status === "completed" ? "selected" : ""}>${html(tr("completedAppointment"))}</option><option value="cancelled" ${item.status === "cancelled" ? "selected" : ""}>${html(tr("cancelledAppointment"))}</option></select></label>${textareaField("notes", tr("customerNotes"), value("notes"), 3, true)}`;
    return "";
  }

  function field(name, label, value = "", type = "text", required = false) {
    const number = type === "number" ? ` min="0" step="0.01"` : "";
    return `<label class="field"><span>${html(label)}</span><input name="${html(name)}" type="${type}" value="${value}"${required ? " required" : ""}${number} /></label>`;
  }

  function textareaField(name, label, value = "", rows = 3, wide = false) {
    return `<label class="field${wide ? " field-wide" : ""}"><span>${html(label)}</span><textarea name="${html(name)}" rows="${rows}">${value}</textarea></label>`;
  }

  function localDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  function entityCollection(kind) {
    return { customer: "customers", device: "devices", stock: "inventory", supplier: "suppliers", order: "purchaseOrders", appointment: "appointments" }[kind];
  }

  function openEntity(kind, id = "", prefill = {}) {
    if (!canWrite()) return showToast(tr("accountSuspended"));
    const collection = entityCollection(kind);
    const item = arrayBy(collection).find((row) => row.id === id) || {};
    state.entityKind = kind;
    state.editingEntityId = id;
    const titleKey = { customer: "addCustomer", device: "addDevice", stock: "addStockItem", supplier: "addSupplier", order: "addPurchaseOrder", appointment: "addAppointment" }[kind];
    $("#rdEntityEyebrow").textContent = tr(collection === "purchaseOrders" ? "inventory" : collection);
    $("#rdEntityTitle").textContent = id ? `${tr("edit")} · ${item.name || item.title || item.number || ""}` : tr(titleKey);
    $("#rdEntityFields").innerHTML = entityFields(kind, item, prefill);
    $("#rdEntityDialog").showModal();
    requestAnimationFrame(() => $("#rdEntityFields input")?.focus());
  }

  function submitEntity(event) {
    event.preventDefault();
    const kind = state.entityKind;
    const collection = entityCollection(kind);
    if (!collection) return;
    const form = event.target;
    const existing = arrayBy(collection).find((item) => item.id === state.editingEntityId);
    const data = Object.fromEntries(new FormData(form));
    const numeric = new Set(["quantity", "minimumQuantity", "cost", "price", "unitCost"]);
    numeric.forEach((key) => { if (Object.hasOwn(data, key)) data[key] = toAmount(data[key]); });
    if (kind === "order") data.total = toAmount(data.unitCost) * Math.max(1, Number(data.quantity) || 1);
    const item = { ...existing, ...data, id: existing?.id || createId(), createdAt: existing?.createdAt || nowIso(), updatedAt: nowIso() };
    workspace()[collection] = existing ? arrayBy(collection).map((row) => row.id === existing.id ? item : row) : [item, ...arrayBy(collection)];
    persistWorkspace();
    $("#rdEntityDialog").close();
    showToast(tr(existing ? "updatedV034" : "created"));
  }

  function setupSignatureCanvas() {
    const canvas = $("#rdSignatureCanvas");
    if (!canvas || canvas.dataset.ready) return;
    canvas.dataset.ready = "1";
    const context = canvas.getContext("2d");
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.strokeStyle = "#17241f";
    const point = (event) => {
      const rect = canvas.getBoundingClientRect();
      const touch = event.touches?.[0] || event;
      return { x: (touch.clientX - rect.left) * canvas.width / rect.width, y: (touch.clientY - rect.top) * canvas.height / rect.height };
    };
    const start = (event) => { event.preventDefault(); state.signatureDrawing = true; const p = point(event); context.beginPath(); context.moveTo(p.x, p.y); };
    const move = (event) => { if (!state.signatureDrawing) return; event.preventDefault(); const p = point(event); context.lineTo(p.x, p.y); context.stroke(); canvas.dataset.signed = "1"; };
    const end = () => { state.signatureDrawing = false; };
    canvas.addEventListener("pointerdown", start);
    canvas.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  }

  function clearSignature() {
    const canvas = $("#rdSignatureCanvas");
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    if (canvas) { canvas.dataset.signed = ""; canvas.dataset.original = ""; }
  }

  function drawSignature(dataUrl) {
    clearSignature();
    const canvas = $("#rdSignatureCanvas");
    if (!canvas || !dataUrl) return;
    const image = new Image();
    image.onload = () => { canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height); canvas.dataset.signed = "1"; canvas.dataset.original = dataUrl; };
    image.src = dataUrl;
  }

  function prepareRepairForm(repair) {
    const members = teamMembers().filter((member) => member.status === "active");
    const select = $("#rdAssigneeInput");
    if (select) select.innerHTML = `<option value="">${html(tr("allAssignees"))}</option>${members.map((member) => `<option value="${html(member.user_id)}">${html(member.display_name || member.email)}</option>`).join("")}`;
    const draft = !repair ? readDraft() : null;
    const source = repair || draft || {};
    if ($("#rdPriorityInput")) $("#rdPriorityInput").value = source.priority || "normal";
    if ($("#rdAssigneeInput")) $("#rdAssigneeInput").value = source.assignedTo || "";
    if ($("#rdImeiInput")) $("#rdImeiInput").value = source.imei || "";
    if ($("#rdTagsInput")) $("#rdTagsInput").value = (source.tags || []).join(", ");
    if ($("#rdConditionInput")) $("#rdConditionInput").value = source.condition || "";
    if ($("#rdAccessoriesInput")) $("#rdAccessoriesInput").value = source.accessories || "";
    if ($("#rdAccessCodeInput")) $("#rdAccessCodeInput").value = source.accessCode || "";
    if ($("#rdWarrantyInput")) $("#rdWarrantyInput").value = source.warrantyUntil || "";
    if ($("#rdIntakeAcceptedInput")) $("#rdIntakeAcceptedInput").checked = Boolean(source.intakeAccepted);
    drawSignature(source.intakeSignature || "");
    if (!repair && draft) {
      const simple = { deviceInput: "device", issueInput: "issue", serialInput: "serial", receivedInput: "received", targetInput: "target", labourInput: "labour", notesInput: "notes", customerNameInput: "customerName", customerPhoneInput: "customerPhone", customerEmailInput: "customerEmail", customerAddressInput: "customerAddress" };
      Object.entries(simple).forEach(([id, key]) => { if (document.getElementById(id) && source[key] != null) document.getElementById(id).value = source[key]; });
      if (source.category) elements.categoryInput.value = source.category;
      if (source.status) elements.statusInput.value = source.status;
    }
  }

  function readRepairFields(existing = null) {
    const canvas = $("#rdSignatureCanvas");
    const signature = canvas?.dataset.signed ? canvas.toDataURL("image/png") : (canvas?.dataset.original || "");
    return {
      brand: existing?.brand || "", model: elements.deviceInput.value.trim(), imei: $("#rdImeiInput")?.value.trim() || "",
      customerId: existing?.customerId || state.prefillCustomerId || "", deviceId: existing?.deviceId || "",
      priority: $("#rdPriorityInput")?.value || "normal", assignedTo: $("#rdAssigneeInput")?.value || "",
      tags: String($("#rdTagsInput")?.value || "").split(",").map((tag) => tag.trim()).filter(Boolean),
      condition: $("#rdConditionInput")?.value.trim() || "", accessories: $("#rdAccessoriesInput")?.value.trim() || "",
      accessCode: $("#rdAccessCodeInput")?.value.trim() || "", warrantyUntil: $("#rdWarrantyInput")?.value || "",
      intakeAccepted: Boolean($("#rdIntakeAcceptedInput")?.checked), intakeSignature: signature,
      diagnosis: existing?.diagnosis || "", attachments: existing?.attachments || [], payments: existing?.payments || [],
      estimate: existing?.estimate || null, portalToken: existing?.portalToken || "", parentRepairId: existing?.parentRepairId || "",
    };
  }

  function saveDraft() {
    if (elements.repairId.value) return;
    const draft = {
      savedAt: nowIso(), device: elements.deviceInput.value, category: elements.categoryInput.value, status: elements.statusInput.value,
      issue: elements.issueInput.value, serial: elements.serialInput.value, received: elements.receivedInput.value, target: elements.targetInput.value,
      labour: elements.labourInput.value, notes: elements.notesInput.value, customerName: elements.customerNameInput.value,
      customerPhone: elements.customerPhoneInput.value, customerEmail: elements.customerEmailInput.value, customerAddress: elements.customerAddressInput.value,
      ...readRepairFields(null),
    };
    writeStorage("repairdesk.draft.v034", JSON.stringify(draft));
    const indicator = $("#rdAutosaveState");
    if (indicator) { indicator.classList.add("saved"); setTimeout(() => indicator.classList.remove("saved"), 600); }
  }

  function readDraft() {
    try {
      const draft = JSON.parse(readStorage("repairdesk.draft.v034") || "null");
      if (!draft?.savedAt || Date.now() - new Date(draft.savedAt).getTime() > 86400000) return null;
      return draft;
    } catch { return null; }
  }

  function afterRepairSaved(repair) {
    const data = workspace();
    let customer = data.customers.find((item) => item.id === repair.customerId);
    if (!customer && (repair.customer.name || repair.customer.email || repair.customer.phone)) {
      customer = data.customers.find((item) => (repair.customer.email && item.email === repair.customer.email) || (repair.customer.phone && item.phone === repair.customer.phone));
      if (!customer) {
        customer = { id: createId(), ...repair.customer, notes: "", createdAt: repair.createdAt, updatedAt: repair.updatedAt };
        data.customers.unshift(customer);
      } else Object.assign(customer, repair.customer, { updatedAt: repair.updatedAt });
      repair.customerId = customer.id;
    }
    let device = data.devices.find((item) => item.id === repair.deviceId);
    if (!device) device = data.devices.find((item) => (repair.imei && item.imei === repair.imei) || (repair.serial && item.serial === repair.serial));
    if (!device) {
      device = { id: createId(), customerId: repair.customerId, brand: repair.brand, model: repair.model || repair.device, category: repair.category, serial: repair.serial, imei: repair.imei, warrantyUntil: repair.warrantyUntil, createdAt: repair.createdAt, updatedAt: repair.updatedAt };
      data.devices.unshift(device);
    } else Object.assign(device, { customerId: repair.customerId || device.customerId, model: repair.model || repair.device, category: repair.category, serial: repair.serial, imei: repair.imei, warrantyUntil: repair.warrantyUntil, updatedAt: repair.updatedAt });
    repair.deviceId = device.id;
    state.prefillCustomerId = "";
    writeStorage("repairdesk.draft.v034", "");
    markSettingsChanged();
    writeStorage(SETTINGS_KEY, JSON.stringify(settingsSnapshot()));
    writeStorage(STORAGE_KEY, JSON.stringify(repairs));
    scheduleCloudSync(50);
  }

  function afterRepairDeleted() {
    render(activeView);
    const toast = $("#toast");
    if (toast) {
      toast.innerHTML = `${html(tr("deleted"))} <button type="button" data-rd-action="undo-delete">${html(tr("restore"))}</button>`;
      toast.classList.add("visible");
    }
  }

  function openRepairDetail(repairId, tab = "overview") {
    if (!repairs.some((repair) => repair.id === repairId)) return;
    state.detailRepairId = repairId;
    state.detailTab = tab;
    renderRepairDetail();
    $("#rdDetailDialog").showModal();
  }

  function renderRepairDetail() {
    const repair = repairs.find((item) => item.id === state.detailRepairId);
    if (!repair) return $("#rdDetailDialog")?.close();
    const tabs = ["overview", "diagnosis", "parts", "estimate", "payments", "documents", ...(flagEnabled("attachments") ? ["attachments"] : []), ...(flagEnabled("customer_portal") ? ["portal"] : []), "history"];
    if (!tabs.includes(state.detailTab)) state.detailTab = "overview";
    const tabLabels = { overview: "repairOverview", diagnosis: "diagnosis", parts: "parts", estimate: "estimate", payments: "payments", documents: "documents", attachments: "attachments", portal: "customerPortal", history: "repairHistory" };
    $("#rdDetailHeader").innerHTML = `<div><p class="device-type">${html(tr(repair.category))} · ${html(priorityLabel(repair.priority))}</p><h2>${html(repair.device)}</h2><p>${html(getIssue(repair))} · ${html(repair.customer?.name || findCustomer(repair.customerId)?.name || "—")}</p></div><div class="rd-detail-actions"><select data-rd-detail-status>${STANDARD_STATUSES.map((status) => `<option value="${status}" ${repair.status === status ? "selected" : ""}>${html(statusLabel(status))}</option>`).join("")}</select><button class="secondary-button" data-rd-action="edit-detail">${html(tr("edit"))}</button><button class="icon-button" data-rd-action="close-detail">×</button></div>`;
    $("#rdDetailTabs").innerHTML = tabs.map((tab) => `<button class="${state.detailTab === tab ? "active" : ""}" data-detail-tab="${tab}">${html(tr(tabLabels[tab]))}</button>`).join("");
    const renderers = { overview: detailOverview, diagnosis: detailDiagnosis, parts: detailParts, estimate: detailEstimate, payments: detailPayments, documents: detailDocuments, attachments: detailAttachments, portal: detailPortal, history: detailHistory };
    $("#rdDetailBody").innerHTML = (renderers[state.detailTab] || detailOverview)(repair);
    if (state.detailTab === "portal" && repair.portalToken) requestAnimationFrame(() => renderQr(portalUrl(repair.portalToken), $("#rdPortalQr")));
  }

  function detailOverview(repair) {
    const paid = repair.payments.reduce((sum, payment) => payment.status === "refunded" ? sum : sum + toAmount(payment.amount), 0);
    const facts = [
      [tr("status"), statusLabel(repair.status)], [tr("priority"), priorityLabel(repair.priority)], [tr("assignee"), assigneeName(repair.assignedTo) || "—"],
      [tr("receivedDate"), formatDate(repair.received)], [tr("targetDate"), formatDate(repair.target)], [tr("serialNumber"), repair.serial || "—"], [tr("imei"), repair.imei || "—"],
      [tr("repairTotal"), formatMoney(getRepairTotal(repair))], [tr("paid"), formatMoney(paid)], [tr("balance"), formatMoney(Math.max(0, getRepairTotal(repair) - paid))], [tr("warrantyUntil"), formatDate(repair.warrantyUntil)],
    ];
    return `<div class="rd-detail-grid"><section class="rd-detail-card"><h3>${html(tr("repairOverview"))}</h3><dl class="rd-facts">${facts.map(([label, value]) => `<div><dt>${html(label)}</dt><dd>${html(value)}</dd></div>`).join("")}</dl></section><section class="rd-detail-card"><h3>${html(tr("customerNameLabel"))}</h3><p><strong>${html(repair.customer?.name || findCustomer(repair.customerId)?.name || "—")}</strong></p><p>${html([repair.customer?.phone, repair.customer?.email, repair.customer?.address].filter(Boolean).join(" · "))}</p><h3>${html(tr("deviceCondition"))}</h3><p>${html(repair.condition || "—")}</p><h3>${html(tr("accessories"))}</h3><p>${html(repair.accessories || "—")}</p></section></div>${repair.parentRepairId ? `<p class="rd-related"><strong>${html(tr("warrantyReturn"))}:</strong> <button class="text-button" data-rd-action="open-repair" data-repair-id="${html(repair.parentRepairId)}">${html(tr("relatedRepair"))}</button></p>` : ""}<div class="rd-detail-footer"><button class="secondary-button" data-rd-action="create-warranty-return">${html(tr("createWarrantyReturn"))}</button></div>`;
  }

  function detailDiagnosis(repair) {
    return `<form id="rdDiagnosisForm" class="rd-detail-form"><label class="field"><span>${html(tr("diagnosisNotes"))}</span><textarea name="diagnosis" rows="10" maxlength="3000">${html(repair.diagnosis)}</textarea></label><button class="primary-button" type="submit">${html(tr("saveDiagnosis"))}</button></form>`;
  }

  function detailParts(repair) {
    return `<div class="rd-table-shell"><table class="rd-table"><thead><tr><th>${html(tr("partName"))}</th><th>${html(tr("sku"))}</th><th>${html(tr("quantity"))}</th><th>${html(tr("purchaseCost"))}</th><th>${html(tr("salePrice"))}</th><th>${html(tr("orderStatus"))}</th></tr></thead><tbody>${repair.parts.map((part) => `<tr><td>${html(getPartName(part))}</td><td>${html(part.sku || "—")}</td><td>${html(part.quantity || 1)}</td><td>${html(formatMoney(part.cost))}</td><td>${html(formatMoney(part.price))}</td><td>${html(part.order?.status ? tr(part.order.status === "received" ? "receivedStatus" : part.order.status) : "—")}</td></tr>`).join("") || `<tr><td colspan="6">${html(tr("noParts"))}</td></tr>`}</tbody></table></div><button class="primary-button" data-rd-action="edit-detail">${html(tr("addPart"))}</button>`;
  }

  function detailEstimate(repair) {
    const estimate = repair.estimate || {};
    return `<form id="rdEstimateForm" class="rd-detail-form"><div class="form-grid"><label class="field"><span>${html(tr("estimateAmount"))}</span><input name="amount" type="number" min="0" step="0.01" value="${html(estimate.amount ?? getRepairTotal(repair))}" /></label><label class="field"><span>${html(tr("status"))}</span><select name="status">${["draft", "sent", "approved", "rejected"].map((status) => `<option value="${status}" ${estimate.status === status ? "selected" : ""}>${html(tr(`estimate${status[0].toUpperCase()}${status.slice(1)}`))}</option>`).join("")}</select></label><label class="field field-wide"><span>${html(tr("estimateNote"))}</span><textarea name="note" rows="5">${html(estimate.note || "")}</textarea></label></div><button class="primary-button" type="submit">${html(tr("saveSettings"))}</button></form>`;
  }

  function detailPayments(repair) {
    const paid = repair.payments.reduce((sum, payment) => payment.status === "refunded" ? sum : sum + toAmount(payment.amount), 0);
    const partsCost = repair.parts.reduce((sum, part) => sum + toAmount(part.cost) * Number(part.quantity || 1), 0);
    return `<div class="rd-summary-strip">${metric(tr("repairTotal"), formatMoney(getRepairTotal(repair)), tr("repairValue"), "neutral", "repairs")}${metric(tr("paid"), formatMoney(paid), tr("deposit"), "success", "repairs")}${metric(tr("balance"), formatMoney(Math.max(0, getRepairTotal(repair) - paid)), tr("payments"), "warning", "repairs")}${metric(tr("profit"), formatMoney(Math.max(0, paid - partsCost)), tr("purchaseCost"), "accent", "reports")}</div><div class="rd-payment-layout"><form id="rdPaymentForm" class="rd-detail-form"><h3>${html(tr("addPayment"))}</h3><label class="field"><span>${html(tr("paymentAmount"))}</span><input name="amount" type="number" min="0" step="0.01" required /></label><label class="field"><span>${html(tr("paymentMethod"))}</span><select name="method"><option value="cash">${html(tr("paymentCash"))}</option><option value="card">${html(tr("paymentCard"))}</option><option value="transfer">${html(tr("paymentTransfer"))}</option><option value="other">${html(tr("paymentOther"))}</option></select></label><button class="primary-button" type="submit">${html(tr("addPayment"))}</button></form><section class="rd-payment-list">${repair.payments.map((payment) => `<article><div><strong>${html(formatMoney(payment.amount))}</strong><span>${html(tr(`payment${String(payment.method || "other")[0].toUpperCase()}${String(payment.method || "other").slice(1)}`))} · ${html(formatDateTime(payment.paidAt || payment.createdAt))}</span></div><button class="text-button" data-rd-action="remove-payment" data-id="${html(payment.id)}">×</button></article>`).join("") || `<p>${html(tr("noItems"))}</p>`}</section></div>`;
  }

  function detailDocuments(repair) {
    const docs = Object.entries(repair.documents || {});
    return `<div class="rd-document-actions"><button class="primary-button" data-rd-action="open-document" data-kind="receipt">${html(tr("receipt"))}</button><button class="primary-button" data-rd-action="open-document" data-kind="invoice">${html(tr("invoice"))}</button></div><div class="rd-record-grid">${docs.map(([kind, doc]) => `<article class="rd-record-card"><h3>${html(tr(kind))}</h3><strong>${html(doc.number || "—")}</strong><p>${html(formatDateTime(doc.createdAt))}</p><button class="secondary-button" data-rd-action="open-document" data-kind="${html(kind)}">${html(tr("documentPreview"))}</button></article>`).join("") || `<p>${html(tr("noItems"))}</p>`}</div>`;
  }

  function detailAttachments(repair) {
    return `<div class="rd-upload-box"><label class="primary-button">+ ${html(tr("addFiles"))}<input id="rdAttachmentInput" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple hidden /></label><span>${html(tr("maxFileSize"))}</span></div><div class="rd-attachment-grid">${repair.attachments.map((attachment) => `<article><button data-rd-action="open-attachment" data-path="${html(attachment.storagePath)}"><span>${attachment.mimeType === "application/pdf" ? "PDF" : "IMG"}</span><strong>${html(attachment.fileName)}</strong><small>${html(formatAdminBytes(attachment.size))}</small></button><button class="text-button" data-rd-action="delete-attachment" data-id="${html(attachment.id)}">×</button></article>`).join("") || `<p>${html(tr("noItems"))}</p>`}</div>`;
  }

  function portalUrl(token) {
    const url = new URL(window.REPAIRDESK_CONFIG?.siteUrl || window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("portal", token);
    return url.href;
  }

  function detailPortal(repair) {
    if (!repair.portalToken) return `<div class="rd-portal-empty"><span>↗</span><h3>${html(tr("customerPortal"))}</h3><p>${html(tr("portalDisabled"))}</p><button class="primary-button" data-rd-action="create-portal">${html(tr("portalCreate"))}</button></div>`;
    const url = portalUrl(repair.portalToken);
    return `<div class="rd-portal-manage"><div id="rdPortalQr" class="rd-qr"></div><div><h3>${html(tr("customerPortal"))}</h3><p class="rd-link-value">${html(url)}</p><div class="inline-actions"><button class="primary-button" data-rd-action="copy-portal">${html(tr("portalCopy"))}</button><a class="secondary-button" href="${html(url)}" target="_blank" rel="noopener">${html(tr("portalOpen"))}</a></div></div></div>`;
  }

  function detailHistory(repair) {
    return `<div class="rd-detail-timeline">${[...(repair.history || [])].sort((a, b) => new Date(b.at) - new Date(a.at)).map((event) => `<article><i></i><div><strong>${html(historyEventLabel(event.type))}</strong><p>${html(historyEventCopy(event))}</p><time>${html(formatDateTime(event.at))}</time></div></article>`).join("")}</div>`;
  }

  function renderQr(value, root) {
    if (!root) return;
    root.replaceChildren();
    if (window.QRCode) new window.QRCode(root, { text: value, width: 180, height: 180, colorDark: "#17241f", colorLight: "#ffffff", correctLevel: window.QRCode.CorrectLevel.M });
  }

  async function uploadAttachments(files) {
    const repair = repairs.find((item) => item.id === state.detailRepairId);
    const workshopId = state.cloud.workshopAccess?.workshop?.id || cloudProfile?.active_workshop_id;
    if (!repair || !workshopId || !cloudUser) return showToast(tr("uploadRequiresCloud"));
    const input = $("#rdAttachmentInput");
    if (input) input.disabled = true;
    try {
      for (const file of [...files].slice(0, 10)) {
        const uploaded = await RepairDeskCloud.uploadAttachment(workshopId, repair.id, file);
        repair.attachments.push({ id: createId(), kind: file.type === "application/pdf" ? "document" : "photo", fileName: uploaded.fileName, storagePath: uploaded.path, mimeType: uploaded.mimeType, size: uploaded.size, createdAt: nowIso() });
      }
      repair.updatedAt = nowIso();
      persistRepairs({ renderView: false });
      renderRepairDetail();
      showToast(tr("saved"));
    } catch (error) { showToast(error.message || tr("syncFailed")); }
    finally { if (input) input.disabled = false; }
  }

  function createWarrantyReturn() {
    const original = repairs.find((item) => item.id === state.detailRepairId);
    if (!original) return;
    const next = normalizeRepair({ ...original, id: createId(), status: "intake", issue: `${tr("warrantyReturn")}: ${getIssue(original)}`, parentRepairId: original.id, payments: [], estimate: null, documents: {}, attachments: [], history: [], createdAt: nowIso(), updatedAt: nowIso(), received: new Date().toISOString().slice(0, 10), target: "", labour: 0, parts: [] });
    repairs = [next, ...repairs];
    saveRepairs();
    $("#rdDetailDialog").close();
    showView("repairs", next.id);
    openRepairDetail(next.id);
  }

  function undoLastDelete() {
    const item = workspace().trash.find((row) => row.kind === "repair");
    if (!item?.data) return;
    repairs = [normalizeRepair({ ...item.data, updatedAt: nowIso() }), ...repairs.filter((repair) => repair.id !== item.data.id)];
    deletedRepairs = deletedRepairs.filter((row) => row.id !== item.data.id);
    workspace().trash = workspace().trash.filter((row) => row !== item);
    saveRepairs();
    persistWorkspace();
    showToast(tr("restored"));
  }

  function renderSettings() {
    const teamRoot = $("#rdTeamSettings");
    if (!teamRoot) return;
    const access = state.cloud.workshopAccess;
    const members = access?.members || [];
    const invites = access?.invites || [];
    teamRoot.innerHTML = `<div class="settings-card-heading"><span class="settings-number">04</span><div><h2>${html(tr("teamAccess"))}</h2><p>${html(tr("teamAccessCopy"))}</p></div></div>
      ${cloudUser && !access ? `<div class="rd-migration-warning"><strong>${html(tr("databaseUpdateRequired"))}</strong><p>${html(tr("databaseUpdateCopy"))}</p></div>` : ""}
      <p class="rd-role-label">${html(tr("yourRole"))}: <strong>${html(tr(role()))}</strong></p>
      <div class="rd-team-list">${members.map((member) => `<article><span class="rd-avatar">${html((member.display_name || member.email || "?")[0].toUpperCase())}</span><div><strong>${html(member.display_name || member.email)}</strong><span>${html(member.email)} · ${html(tr(member.role))}</span></div>${canManage() && member.role !== "owner" ? `<select data-member-role="${html(member.user_id)}"><option value="manager" ${member.role === "manager" ? "selected" : ""}>${html(tr("manager"))}</option><option value="technician" ${member.role === "technician" ? "selected" : ""}>${html(tr("technician"))}</option><option value="viewer" ${member.role === "viewer" ? "selected" : ""}>${html(tr("viewer"))}</option></select><button class="text-button" data-rd-action="toggle-member" data-id="${html(member.user_id)}" data-status="${member.status === "active" ? "disabled" : "active"}">${html(tr(member.status === "active" ? "disableMember" : "restoreMember"))}</button>` : ""}</article>`).join("") || `<p>${html(tr("noItems"))}</p>`}</div>
      ${canManage() && access ? `<form id="rdInviteForm" class="rd-inline-form"><label class="field"><span>${html(tr("emailLabel"))}</span><input name="email" type="email" required /></label><label class="field"><span>${html(tr("yourRole"))}</span><select name="role"><option value="technician">${html(tr("technician"))}</option><option value="manager">${html(tr("manager"))}</option><option value="viewer">${html(tr("viewer"))}</option></select></label><button class="primary-button" type="submit">${html(tr("inviteTeamMember"))}</button></form>` : ""}
      ${invites.length ? `<div class="rd-invite-list">${invites.map((invite) => `<span>${html(invite.email)} · ${html(tr(invite.role))} · ${html(formatDateTime(invite.expires_at))}</span>`).join("")}</div>` : ""}`;

    const flow = $("#rdWorkflowSettings");
    flow.innerHTML = `<div class="settings-card-heading"><span class="settings-number">05</span><div><h2>${html(tr("workflowSettings"))}</h2><p>${html(tr("workflowSettingsCopy"))}</p></div></div><div class="rd-status-flow">${STANDARD_STATUSES.map((status) => `<span class="status-badge ${html(status)}">${html(statusLabel(status))}</span>`).join("<i>→</i>")}</div><div class="rd-custom-statuses">${arrayBy("customStatuses").map((item) => `<span>${html(item.name)}<button data-rd-action="remove-custom-status" data-id="${html(item.id)}">×</button></span>`).join("")}</div><form id="rdStatusForm" class="rd-inline-form"><label class="field"><span>${html(tr("customStatusName"))}</span><input name="name" maxlength="40" required /></label><button class="secondary-button" type="submit">+ ${html(tr("created"))}</button></form>`;

    const docs = workspace().documentSettings;
    $("#rdDocumentSettings").innerHTML = `<div class="settings-card-heading"><span class="settings-number">06</span><div><h2>${html(tr("documentSettings"))}</h2><p>${html(tr("documentSettingsCopy"))}</p></div></div><form id="rdDocumentSettingsForm" class="form-grid settings-fields">${field("logoUrl", tr("logoUrl"), html(docs.logoUrl), "url")}${field("defaultWarrantyDays", tr("defaultWarrantyDays"), docs.defaultWarrantyDays, "number")}${field("receiptTitle", tr("receiptTemplateTitle"), html(docs.receiptTitle))}${field("invoiceTitle", tr("invoiceTemplateTitle"), html(docs.invoiceTitle))}${field("emailSubject", tr("emailTemplateSubject"), html(docs.emailSubject))}${textareaField("emailMessage", tr("emailTemplateMessage"), html(docs.emailMessage), 4, true)}${textareaField("footer", tr("documentFooter"), html(docs.footer), 3, true)}<button class="primary-button" type="submit">${html(tr("saveSettings"))}</button></form>`;

    const trash = arrayBy("trash");
    $("#rdDataSettings").innerHTML = `<div class="settings-card-heading"><span class="settings-number">07</span><div><h2>${html(tr("dataTools"))}</h2><p>${html(tr("dataToolsCopy"))}</p></div></div><div class="rd-data-actions"><button class="secondary-button" data-rd-action="export-json">${html(tr("exportJson"))}</button><button class="secondary-button" data-rd-action="export-repairs-csv">${html(tr("exportCsvFull"))}</button><label class="secondary-button">${html(tr("importJson"))}<input id="rdImportInput" type="file" accept="application/json" hidden /></label></div><div class="rd-trash-head"><h3>${html(tr("trash"))} · ${trash.length}</h3>${trash.length ? `<button class="danger-button" data-rd-action="empty-trash">${html(tr("emptyTrash"))}</button>` : ""}</div><div class="rd-trash-list">${trash.map((item, index) => `<article><div><strong>${html(item.data?.device || item.data?.name || item.kind)}</strong><span>${html(formatDateTime(item.deletedAt))}</span></div><button class="text-button" data-rd-action="restore-trash" data-index="${index}">${html(tr("restore"))}</button></article>`).join("") || `<p>${html(tr("noItems"))}</p>`}</div><p class="privacy-note"><span>↳</span><span>${html(tr("shortcutsHint"))}</span></p>`;

    $("#rdInstallSettings").innerHTML = `<div class="settings-card-heading"><span class="settings-number">08</span><div><h2>${html(tr("installApp"))}</h2><p>${html(tr("installAppCopy"))}</p></div></div><div class="rd-install-row"><div><strong>${html(tr("autosaveOn"))}</strong><span id="rdOfflineQueueLabel">${html(tr("pendingChanges", { count: cloudSyncPending ? 1 : 0 }))}</span></div><button class="primary-button" data-rd-action="install-app" ${state.pendingInstall ? "" : "disabled"}>${html(tr("install"))}</button></div>`;
  }

  function adminTabButtons() {
    const tabs = ["overview", "users", "workshops", "analytics", "feedback", "system", "security", "releases"];
    const keys = { overview: "ownerOverview", users: "ownerUsers", workshops: "ownerWorkshops", analytics: "ownerAnalytics", feedback: "ownerFeedback", system: "ownerSystem", security: "ownerSecurity", releases: "ownerReleases" };
    return tabs.map((tab) => `<button class="${state.adminTab === tab ? "active" : ""}" data-admin-tab="${tab}">${html(tr(keys[tab]))}</button>`).join("");
  }

  function adminDateRange() {
    const today = new Date();
    const to = state.adminTo || today.toISOString().slice(0, 10);
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - (state.adminRange - 1));
    const from = state.adminFrom || fromDate.toISOString().slice(0, 10);
    return { from, to };
  }

  async function loadAdmin(force = false) {
    if (!cloudProfile?.is_admin || state.adminLoading) return;
    if (state.adminData && !force) return renderAdminContent();
    state.adminLoading = true;
    const status = $("#rdAdminStatus");
    if (status) status.textContent = tr("analyticsLoading");
    try {
      const range = adminDateRange();
      state.adminData = await RepairDeskCloud.loadAdminDashboard(range.from, range.to);
      if (state.adminTab === "users") await loadAdvancedUsers(true);
      if (state.adminTab === "workshops") state.adminWorkshops = await RepairDeskCloud.loadAdminWorkshops("", 100, 0);
      if (status) status.textContent = tr("analyticsUpdated", { time: formatSyncTime(state.adminData?.generated_at) });
      renderAdminContent();
    } catch (error) {
      if (status) { status.textContent = error.message || tr("analyticsLoadFailed"); status.classList.add("error"); }
      $("#rdAdminContent").innerHTML = `<div class="rd-migration-warning"><strong>${html(tr("databaseUpdateRequired"))}</strong><p>${html(tr("databaseUpdateCopy"))}</p></div>`;
    } finally { state.adminLoading = false; }
  }

  function renderAdmin() {
    const root = $("#rdAdminRoot");
    if (!root || !cloudProfile?.is_admin) return;
    $("#rdAdminTabs").innerHTML = adminTabButtons();
    $("#rdAdminRange").value = state.adminRange === 0 ? "custom" : String(state.adminRange);
    $("#rdAdminFrom").hidden = state.adminRange !== 0;
    $("#rdAdminTo").hidden = state.adminRange !== 0;
    if (!state.adminData) loadAdmin(); else renderAdminContent();
  }

  function advancedTotals() {
    const totals = state.adminData?.totals || {};
    return {
      total_users: totals.total_users ?? 0,
      registered: totals.registered ?? totals.new_users_30d ?? 0,
      active_today: totals.active_today ?? 0,
      active_7d: totals.active_7d ?? 0,
      active_30d: totals.active_30d ?? totals.active_7d ?? 0,
      returning: totals.returning_period ?? totals.returning_30d ?? 0,
      churned: totals.churned_period ?? 0,
      workshops: totals.workshops ?? totals.cloud_workspaces ?? 0,
      repairs: totals.repairs_total ?? totals.total_repairs ?? 0,
      repairs_created: totals.repairs_created ?? 0,
      repairs_completed: totals.repairs_completed ?? 0,
      feedback: totals.open_feedback ?? 0,
      events: totals.events ?? totals.events_30d ?? 0,
      gross: totals.gross_value ?? 0,
      payments: totals.payments ?? 0,
    };
  }

  function compareValue(current, previous) {
    const before = Number(previous) || 0;
    const now = Number(current) || 0;
    if (!before) return now ? "+100%" : "0%";
    const change = Math.round((now - before) / before * 100);
    return `${change > 0 ? "+" : ""}${change}%`;
  }

  function adminMetric(label, value, previous, hint = "") {
    const change = previous == null ? "" : compareValue(value, previous);
    return `<article class="stat-card"><div class="stat-card-top"><span>${html(label)}</span>${change ? `<i class="rd-change ${change.startsWith("-") ? "down" : "up"}">${html(change)}</i>` : ""}</div><strong>${html(value)}</strong><p>${html(hint || tr("comparePrevious"))}</p></article>`;
  }

  function renderAdminContent() {
    const root = $("#rdAdminContent");
    if (!root || !state.adminData) return;
    const renderers = { overview: renderAdminOverview, users: renderAdminUsersV034, workshops: renderAdminWorkshops, analytics: renderAdminAnalytics, feedback: renderAdminFeedbackV034, system: renderAdminSystem, security: renderAdminSecurity, releases: renderAdminReleases };
    root.innerHTML = (renderers[state.adminTab] || renderAdminOverview)();
    if (state.adminTab === "users" && !state.adminUsers) loadAdvancedUsers(true);
    if (state.adminTab === "workshops" && !state.adminWorkshops) loadAdminWorkshops();
    if (state.adminTab === "security") loadMfaState();
  }

  function renderAdminOverview() {
    const totals = advancedTotals();
    const previous = state.adminData.previous || {};
    const atRisk = Math.max(0, totals.active_30d - totals.active_7d);
    return `<section class="stats-grid rd-owner-stats">${adminMetric(tr("registeredUsers"), adminCount(totals.total_users), previous.registered, `${adminCount(totals.registered)} ${tr("filterNew").toLowerCase()}`)}${adminMetric(tr("activeToday"), adminCount(totals.active_today), previous.active, `WAU ${adminCount(totals.active_7d)} · MAU ${adminCount(totals.active_30d)}`)}${adminMetric(tr("returningUsers"), adminCount(totals.returning), null, `${tr("filterInactive")}: ${adminCount(atRisk)}`)}${adminMetric(tr("cloudWorkspaces"), adminCount(totals.workshops), null, `${adminCount(totals.repairs)} ${tr("repairs").toLowerCase()}`)}${adminMetric(tr("completedRepairs"), adminCount(totals.repairs_completed), previous.repairs_completed, `${adminCount(totals.repairs_created)} ${tr("created").toLowerCase()}`)}${adminMetric(tr("openFeedback"), adminCount(totals.feedback), null, `${adminCount(totals.events)} ${tr("events").toLowerCase()}`)}</section>
      <div class="rd-admin-dashboard-grid"><section class="settings-card rd-admin-chart-panel"><div class="admin-section-heading"><div><p class="eyebrow"><span></span> <span>${html(tr("dateRange"))}</span></p><h2>${html(tr("userGrowth"))}</h2></div><div class="rd-segment"><button class="${state.adminGranularity === "day" ? "active" : ""}" data-admin-granularity="day">D</button><button class="${state.adminGranularity === "week" ? "active" : ""}" data-admin-granularity="week">W</button></div></div>${adminDailyChart()}</section><section class="settings-card"><h2>${html(tr("productFunnel"))}</h2>${funnelChart()}</section></div>
      <div class="rd-admin-dashboard-grid"><section class="settings-card"><h2>${html(tr("systemHealth"))}</h2>${systemHealthSummary()}</section><section class="settings-card"><h2>${html(tr("releaseAdoption"))}</h2>${breakdown(state.adminData.version_breakdown || [])}</section></div>`;
  }

  function aggregateAdminDaily() {
    const daily = state.adminData?.daily || [];
    if (state.adminGranularity === "day") return daily;
    return [...daily.reduce((map, row) => {
      const date = new Date(`${row.day}T12:00:00`);
      const monday = new Date(date);
      monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      const value = map.get(key) || { day: key, active_users: 0, events: 0, repairs_created: 0, repairs_completed: 0 };
      value.active_users = Math.max(value.active_users, Number(row.active_users) || 0);
      value.events += Number(row.events) || 0;
      value.repairs_created += Number(row.repairs_created) || 0;
      value.repairs_completed += Number(row.repairs_completed) || 0;
      map.set(key, value);
      return map;
    }, new Map()).values()];
  }

  function adminDailyChart() {
    const daily = aggregateAdminDaily();
    const max = Math.max(1, ...daily.flatMap((row) => [Number(row.active_users) || 0, Number(row.events) || 0]));
    if (!daily.some((row) => Number(row.active_users) || Number(row.events))) return `<div class="rd-sparse-chart"><strong>${html(tr("noAnalyticsYet"))}</strong><p>${html(tr("userGrowth"))}</p></div>`;
    return `<div class="rd-admin-bars">${daily.map((row) => `<div title="${html(formatDate(row.day))} · ${tr("activeUsers")}: ${row.active_users || 0} · ${tr("events")}: ${row.events || 0}"><span><i style="height:${(Number(row.active_users) || 0) / max * 100}%"></i><b style="height:${(Number(row.events) || 0) / max * 100}%"></b></span><time>${html(String(row.day).slice(5))}</time></div>`).join("")}</div><div class="admin-legend"><span><i class="users"></i>${html(tr("activeUsers"))}</span><span><i class="events"></i>${html(tr("events"))}</span></div>`;
  }

  function funnelChart() {
    const rows = state.adminData?.funnel || [];
    const labels = { registered: "registeredUsers", confirmed: "confirmed", onboarded: "workshopOverview", first_repair: "newRepair", returned: "returningUsers" };
    const max = Math.max(1, ...rows.map((row) => Number(row.count) || 0));
    return `<div class="rd-funnel">${rows.map((row, index) => `<div style="width:${Math.max(34, (Number(row.count) || 0) / max * 100)}%"><span>${index + 1}</span><strong>${html(tr(labels[row.key] || row.key))}</strong><b>${html(adminCount(row.count))}</b></div>`).join("") || `<p>${html(tr("noAnalyticsYet"))}</p>`}</div>`;
  }

  function systemHealthSummary() {
    const system = state.adminData?.system || {};
    const rate = Number(system.sync_success_rate_30d ?? 100);
    return `<div class="rd-health-score"><strong class="${rate >= 98 ? "good" : rate >= 90 ? "warning" : "bad"}">${html(`${rate}%`)}</strong><span>${html(tr("syncSuccessRate"))}</span></div><dl class="rd-facts"><div><dt>${html(tr("conflicts24h"))}</dt><dd>${html(adminCount(system.sync_conflicts_24h))}</dd></div><div><dt>${html(tr("staleWorkshops"))}</dt><dd>${html(adminCount(system.stale_workspaces_30d))}</dd></div><div><dt>${html(tr("databaseSize"))}</dt><dd>${html(formatAdminBytes(system.database_bytes))}</dd></div><div><dt>${html(tr("attachmentSize"))}</dt><dd>${html(formatAdminBytes(system.attachment_bytes))}</dd></div></dl>`;
  }

  async function loadAdvancedUsers(reset = true) {
    if (!cloudProfile?.is_admin) return;
    try {
      const offset = reset ? 0 : state.adminUsers?.users?.length || 0;
      const page = await RepairDeskCloud.loadAdminUsers(state.adminUserQuery, 50, offset, state.adminUserFilter);
      state.adminUsers = reset ? page : { ...page, users: [...(state.adminUsers?.users || []), ...(page.users || [])] };
      if (state.adminTab === "users") renderAdminContent();
    } catch (error) { $("#rdAdminStatus").textContent = error.message; }
  }

  function renderAdminUsersV034() {
    const rows = state.adminUsers?.users || [];
    const total = Number(state.adminUsers?.total) || 0;
    const filters = ["all", "new", "active", "unconfirmed", "no_repairs", "inactive", "sync_issues", "suspended"];
    const keys = { all: "filterAll", new: "filterNew", active: "filterActive", unconfirmed: "filterUnconfirmed", no_repairs: "filterNoRepairs", inactive: "filterInactive", sync_issues: "filterSyncIssues", suspended: "filterSuspended" };
    return `<section class="settings-card"><div class="rd-directory-toolbar"><label class="search-field">${icons("main")}<input id="rdAdminUserSearch" type="search" value="${html(state.adminUserQuery)}" placeholder="${html(tr("searchUsers"))}" /></label><div class="rd-filter-chips">${filters.map((filter) => `<button class="${state.adminUserFilter === filter ? "active" : ""}" data-admin-user-filter="${filter}">${html(tr(keys[filter]))}</button>`).join("")}</div></div><p>${html(tr("adminUserCount", { shown: rows.length, total }))}</p><div class="rd-table-shell"><table class="rd-table"><thead><tr><th>${html(tr("user"))}</th><th>${html(tr("status"))}</th><th>${html(tr("lastActive"))}</th><th>${html(tr("lastSync"))}</th><th>${html(tr("repairs"))}</th><th>${html(tr("syncConflicts"))}</th><th></th></tr></thead><tbody>${rows.map((user) => `<tr><td><strong>${html(user.email || user.id)}</strong><span class="rd-cell-meta">${html(user.workshop_name || "—")} · ${html([user.country, user.language, user.currency].filter(Boolean).join(" · "))}</span></td><td><span class="rd-account-status ${html(user.account_status || "active")}">${html(tr(user.account_status === "suspended" ? "accountSuspended" : "accountActive"))}</span>${user.email_confirmed_at ? "" : `<span class="rd-cell-meta">${html(tr("pendingConfirmation"))}</span>`}</td><td>${html(formatSyncTime(user.last_seen_at || user.last_sign_in_at))}</td><td>${html(formatSyncTime(user.last_sync_at))}</td><td>${html(adminCount(user.repair_count))}</td><td>${html(adminCount(user.sync_conflicts))}</td><td><button class="secondary-button" data-rd-action="open-admin-user" data-id="${html(user.id)}">${html(tr("openUser"))}</button></td></tr>`).join("") || `<tr><td colspan="7">${html(tr("searchNoResults"))}</td></tr>`}</tbody></table></div>${rows.length < total ? `<button class="secondary-button rd-load-more" data-rd-action="admin-users-more">${html(tr("loadMore"))}</button>` : ""}</section>`;
  }

  async function openAdminUser(userId) {
    try {
      state.adminDetail = await RepairDeskCloud.loadAdminUserDetail(userId);
      renderAdminUserDetail();
      $("#rdAdminUserDialog").showModal();
    } catch (error) { showToast(error.message); }
  }

  function renderAdminUserDetail() {
    const data = state.adminDetail;
    if (!data) return;
    const user = data.user || {};
    const profile = data.profile || {};
    const repairSummary = data.repair_summary || {};
    $("#rdAdminUserTitle").textContent = user.email || user.id || tr("userProfile");
    $("#rdAdminUserBody").innerHTML = `<div class="rd-admin-user-summary"><section><span class="rd-avatar large">${html((user.email || "?")[0].toUpperCase())}</span><h3>${html(profile.workshop_name || data.workshop?.name || "—")}</h3><p>${html([profile.country, profile.language, profile.currency].filter(Boolean).join(" · "))}</p><span class="rd-account-status ${html(profile.account_status || "active")}">${html(tr(profile.account_status === "suspended" ? "accountSuspended" : "accountActive"))}</span></section><dl class="rd-facts"><div><dt>${html(tr("joined"))}</dt><dd>${html(formatDateTime(user.created_at))}</dd></div><div><dt>${html(tr("lastLogin"))}</dt><dd>${html(formatSyncTime(user.last_sign_in_at))}</dd></div><div><dt>${html(tr("lastSync"))}</dt><dd>${html(formatSyncTime(data.workspace?.last_sync_at))}</dd></div><div><dt>${html(tr("repairs"))}</dt><dd>${html(repairSummary.total || 0)}</dd></div><div><dt>${html(tr("repairValue"))}</dt><dd>${html(formatMoneyFor(Number(repairSummary.value) || 0, profile.language || "en", profile.currency || "USD"))}</dd></div><div><dt>${html(tr("dataSize"))}</dt><dd>${html(formatAdminBytes(data.workspace?.bytes))}</dd></div></dl></div>
      <div class="rd-admin-actions"><button class="secondary-button" data-rd-action="admin-reset-password" data-email="${html(user.email)}">${html(tr("sendPasswordReset"))}</button><button class="secondary-button" data-rd-action="admin-export-user" data-id="${html(user.id)}">${html(tr("exportUserData"))}</button><button class="${profile.account_status === "suspended" ? "secondary-button" : "danger-button"}" data-rd-action="admin-toggle-user" data-id="${html(user.id)}" data-status="${profile.account_status === "suspended" ? "active" : "suspended"}">${html(tr(profile.account_status === "suspended" ? "restoreAccount" : "suspendAccount"))}</button><button class="danger-button" data-rd-action="admin-delete-user" data-id="${html(user.id)}" data-email="${html(user.email)}">${html(tr("deleteAccount"))}</button></div>
      <div class="rd-admin-detail-grid"><section class="settings-card"><h3>${html(tr("recentDevices"))}</h3>${(data.sync || []).map((row) => `<p><strong>${html(row.device_id || "—")}</strong><span>${html(row.result)} · v${html(row.app_version || "—")} · ${html(formatDateTime(row.created_at))}</span></p>`).join("") || `<p>${html(tr("noItems"))}</p>`}</section><section class="settings-card"><h3>${html(tr("supportNotes"))}</h3><form id="rdSupportNoteForm"><textarea name="note" rows="3" required></textarea><button class="primary-button" type="submit">${html(tr("addSupportNote"))}</button></form>${(data.support_notes || []).map((note) => `<p><strong>${html(note.admin_email)}</strong><span>${html(note.note)} · ${html(formatDateTime(note.created_at))}</span></p>`).join("")}</section></div>`;
  }

  async function loadAdminWorkshops() {
    try { state.adminWorkshops = await RepairDeskCloud.loadAdminWorkshops("", 100, 0); if (state.adminTab === "workshops") renderAdminContent(); }
    catch (error) { $("#rdAdminStatus").textContent = error.message; }
  }

  function renderAdminWorkshops() {
    const rows = state.adminWorkshops?.workspaces || [];
    return `<section class="settings-card"><h2>${html(tr("workshopDirectory"))} · ${html(adminCount(state.adminWorkshops?.total))}</h2><div class="rd-table-shell"><table class="rd-table"><thead><tr><th>${html(tr("workshopName"))}</th><th>${html(tr("owner"))}</th><th>${html(tr("members"))}</th><th>${html(tr("repairs"))}</th><th>${html(tr("customers"))}</th><th>${html(tr("lastSynchronised"))}</th><th>${html(tr("dataSize"))}</th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${html(row.name)}</strong><span class="rd-cell-meta">${html(row.country)} · ${html(row.currency)} · ${html(row.plan)}</span></td><td>${html(row.owner_email)}</td><td>${html(adminCount(row.members))}</td><td>${html(adminCount(row.repairs))}</td><td>${html(adminCount(row.customers))}</td><td>${html(formatSyncTime(row.last_sync_at))}</td><td>${html(formatAdminBytes(row.bytes))}</td></tr>`).join("") || `<tr><td colspan="7">${html(tr("noItems"))}</td></tr>`}</tbody></table></div></section>`;
  }

  function renderAdminAnalytics() {
    const totals = advancedTotals();
    const retention = state.adminData.retention || [];
    return `<section class="stats-grid rd-owner-stats">${adminMetric("DAU", adminCount(totals.active_today), null, tr("activeToday"))}${adminMetric("WAU", adminCount(totals.active_7d), null, tr("last7Days"))}${adminMetric("MAU", adminCount(totals.active_30d), null, tr("last30Days"))}${adminMetric(tr("returningUsers"), adminCount(totals.returning), null, tr("retention"))}${adminMetric(tr("churnedUsers"), adminCount(totals.churned), null, tr("comparePrevious"))}${adminMetric(tr("repairValue"), formatMoney(totals.gross), null, tr("repairs"))}${adminMetric(tr("payments"), formatMoney(totals.payments), null, tr("paid"))}</section><div class="rd-admin-dashboard-grid"><section class="settings-card rd-admin-chart-panel"><h2>${html(tr("userGrowth"))}</h2>${adminDailyChart()}</section><section class="settings-card"><h2>${html(tr("productFunnel"))}</h2>${funnelChart()}</section></div><div class="rd-admin-dashboard-grid"><section class="settings-card"><h2>${html(tr("retention"))}</h2><div class="rd-table-shell"><table class="rd-table"><thead><tr><th>Cohort</th><th>Users</th><th>D1</th><th>D7</th><th>D30</th></tr></thead><tbody>${retention.map((row) => `<tr><td>${html(formatDate(row.cohort))}</td><td>${html(row.users)}</td><td>${pct(row.d1, row.users)}</td><td>${pct(row.d7, row.users)}</td><td>${pct(row.d30, row.users)}</td></tr>`).join("") || `<tr><td colspan="5">${html(tr("noAnalyticsYet"))}</td></tr>`}</tbody></table></div></section><section class="settings-card"><h2>${html(tr("productUsage"))}</h2>${breakdown(state.adminData.product_usage || state.adminData.event_breakdown || [], (name) => tr(name))}</section></div><div class="rd-admin-dashboard-grid"><section class="settings-card"><h2>${html(tr("eventActivity"))}</h2>${breakdown(state.adminData.event_breakdown || [])}</section><section class="settings-card"><h2>${html(tr("repairUsage"))}</h2>${breakdown(state.adminData.repair_statuses || [], (name) => statusLabel(name))}</section><section class="settings-card"><h2>${html(tr("categoryDistribution"))}</h2>${breakdown(state.adminData.repair_categories || [], (name) => tr(name))}</section></div>`;
  }

  function pct(value, total) { return html(`${total ? Math.round(Number(value || 0) / Number(total) * 100) : 0}%`); }

  function renderAdminFeedbackV034() {
    const rows = state.adminData.feedback || [];
    return `<div class="rd-feedback-board">${rows.map((item) => `<article class="settings-card" data-admin-feedback="${html(item.id)}"><header><div><span class="admin-feedback-type">${html(item.type)}</span><strong>${html(item.user_email || "—")}</strong><span>${html(item.workshop_name || "—")} · v${html(item.app_version || "—")} · ${html(formatDateTime(item.created_at))}</span></div><select name="status">${["new", "reviewing", "planned", "resolved", "closed"].map((status) => `<option value="${status}" ${item.status === status ? "selected" : ""}>${html(feedbackStatusLabel(status))}</option>`).join("")}</select></header><p>${html(item.message)}</p><div class="form-grid"><label class="field"><span>${html(tr("feedbackPriority"))}</span><select name="priority">${["low", "normal", "high", "urgent"].map((priority) => `<option value="${priority}" ${item.priority === priority ? "selected" : ""}>${html(priorityLabel(priority))}</option>`).join("")}</select></label>${field("category", tr("feedbackCategory"), html(item.category || "general"))}${field("releaseVersion", tr("linkedRelease"), html(item.release_version || ""))}${textareaField("adminNote", tr("adminNote"), html(item.admin_note || ""), 3, true)}</div><button class="primary-button" data-rd-action="save-admin-feedback" data-id="${html(item.id)}">${html(tr("saveFeedback"))}</button></article>`).join("") || `<p>${html(tr("noFeedbackYet"))}</p>`}</div>`;
  }

  function renderAdminSystem() {
    const system = state.adminData.system || {};
    const flags = state.adminData.flags || [];
    return `<div class="rd-system-grid"><section class="settings-card"><h2>${html(tr("systemHealth"))}</h2>${systemHealthSummary()}</section><section class="settings-card"><h2>${html(tr("requestLimits"))}</h2><dl class="rd-facts"><div><dt>Snapshot</dt><dd>8.5 MB / workshop</dd></div><div><dt>${html(tr("attachments"))}</dt><dd>5 MB / file</dd></div><div><dt>Portal</dt><dd>120 req / 10 min</dd></div><div><dt>Users</dt><dd>${html(adminCount(system.auth_users))}</dd></div><div><dt>Events</dt><dd>${html(adminCount(system.analytics_events))}</dd></div></dl></section></div><section class="settings-card"><h2>${html(tr("featureFlags"))}</h2><div class="rd-flags">${flags.map((flag) => `<article data-feature-flag="${html(flag.key)}"><div><strong>${html(flag.key.replaceAll("_", " "))}</strong><p>${html(flag.description || "")}</p></div><label class="rd-switch"><input name="enabled" type="checkbox" ${flag.enabled ? "checked" : ""} /><span></span></label><label class="field"><span>${html(tr("rollout"))}</span><input name="rollout" type="number" min="0" max="100" value="${html(flag.rollout_percent)}" /></label><label class="field"><span>${html(flag.key === "minimum_app_version" ? tr("minimumVersion") : tr("controlValue"))}</span><input name="value" maxlength="120" value="${html(flag.value || "")}" /></label><button class="secondary-button" data-rd-action="save-feature-flag">${html(tr("saveSettings"))}</button></article>`).join("")}</div></section><section class="settings-card"><h2>${html(tr("announcement"))}</h2><form id="rdAnnouncementForm" class="form-grid">${field("title", tr("announcementTitle"), "", "text", true)}<label class="field"><span>${html(tr("audience"))}</span><select name="audience"><option value="all">${html(tr("allUsers"))}</option><option value="admins">${html(tr("ownerPanel"))}</option><option value="active">${html(tr("filterActive"))}</option><option value="inactive">${html(tr("filterInactive"))}</option></select></label><label class="field"><span>${html(tr("priority"))}</span><select name="kind"><option value="info">Info</option><option value="success">Success</option><option value="warning">Warning</option><option value="critical">Critical</option></select></label>${field("endsAt", tr("endsAt"), "", "datetime-local")}${textareaField("message", tr("announcementMessage"), "", 4, true)}<button class="primary-button" type="submit">${html(tr("publishAnnouncement"))}</button></form></section>`;
  }

  function renderAdminSecurity() {
    const system = state.adminData.system || {};
    const security = state.adminData.security || {};
    const audit = state.adminData.audit || [];
    return `<div class="rd-system-grid"><section class="settings-card"><h2>${html(tr("twoFactorAuth"))}</h2><div id="rdMfaPanel"><p>${html(tr("twoFactorDisabled"))}</p></div></section><section class="settings-card"><h2>${html(tr("suspiciousActivity"))}</h2><div class="rd-security-signal ${Number(security.rejected_syncs_24h || system.sync_conflicts_24h) ? "warning" : "good"}"><strong>${html(adminCount(security.rejected_syncs_24h || system.sync_conflicts_24h))}</strong><span>${html(tr("securitySignals24h"))}</span></div><dl class="rd-facts"><div><dt>${html(tr("recentDevices"))}</dt><dd>${html(adminCount(security.recent_devices_30d))}</dd></div><div><dt>${html(tr("suspendedAccounts"))}</dt><dd>${html(adminCount(security.suspended_accounts))}</dd></div><div><dt>${html(tr("adminActions24h"))}</dt><dd>${html(adminCount(security.admin_actions_24h))}</dd></div></dl></section></div><section class="settings-card"><h2>${html(tr("adminAudit"))}</h2><div class="admin-audit-log">${audit.map((item) => `<article class="admin-audit-item"><span class="admin-audit-mark">↳</span><div><strong>${html(String(item.action || "").replaceAll("_", " "))}</strong><span>${html(item.admin_email || "—")} · ${html(item.target_type || "")} ${html(item.target_id || "")} · ${html(formatDateTime(item.created_at))}</span></div></article>`).join("") || `<p>${html(tr("noAudit"))}</p>`}</div></section>`;
  }

  async function loadMfaState() {
    const panel = $("#rdMfaPanel");
    if (!panel) return;
    try {
      const factors = await RepairDeskCloud.listMfaFactors();
      const verified = factors?.totp?.find((factor) => factor.status === "verified");
      panel.innerHTML = verified ? `<div class="rd-mfa-status good"><strong>${html(tr("twoFactorEnabled"))}</strong><button class="danger-button" data-rd-action="disable-mfa" data-id="${html(verified.id)}">${html(tr("disable2fa"))}</button></div>` : `<p>${html(tr("twoFactorDisabled"))}</p><button class="primary-button" data-rd-action="enable-mfa">${html(tr("enable2fa"))}</button>`;
    } catch (error) { panel.textContent = error.message; }
  }

  async function startMfa() {
    try {
      const data = await RepairDeskCloud.enrollMfa();
      state.pendingMfa = data;
      const panel = $("#rdMfaPanel");
      const qr = String(data?.totp?.qr_code || "");
      panel.innerHTML = `<div class="rd-mfa-enroll">${qr.startsWith("data:image") ? `<img src="${html(qr)}" alt="QR" />` : `<div id="rdMfaQr" class="rd-qr"></div>`}<code>${html(data?.totp?.secret || "")}</code><form id="rdMfaVerifyForm"><label class="field"><span>${html(tr("authenticatorCode"))}</span><input name="code" inputmode="numeric" autocomplete="one-time-code" required /></label><button class="primary-button" type="submit">${html(tr("verify"))}</button></form></div>`;
      if (!qr.startsWith("data:image")) renderQr(data?.totp?.uri || qr, $("#rdMfaQr"));
    } catch (error) { showToast(error.message); }
  }

  function renderAdminReleases() {
    const versions = state.adminData.version_breakdown || [];
    const releases = state.adminData.releases || [];
    return `<div class="rd-release-hero"><div><span>${html(tr("currentRelease"))}</span><strong>v${VERSION}</strong><p>${html(tr("production"))} · GitHub Pages</p></div><i>✓</i></div><div class="rd-admin-dashboard-grid"><section class="settings-card"><h2>${html(tr("releaseAdoption"))}</h2>${breakdown(versions)}</section><section class="settings-card"><h2>${html(tr("deploymentState"))}</h2><dl class="rd-facts"><div><dt>Branch</dt><dd>main</dd></div><div><dt>Environment</dt><dd>${html(tr("production"))}</dd></div><div><dt>Version</dt><dd>${VERSION}</dd></div><div><dt>Database</dt><dd>${state.adminData.system ? "v0.3.4" : "legacy"}</dd></div></dl></section></div><section class="settings-card"><h2>${html(tr("releaseHistory"))}</h2><div class="rd-release-list">${releases.map((release) => `<article><i></i><div><strong>v${html(release.version)} · ${html(release.title)}</strong><p>${html(release.notes || "")}</p><span>${html(release.status)} · ${html(formatDateTime(release.released_at || release.created_at))}</span></div></article>`).join("") || `<article><i></i><div><strong>v${VERSION}</strong><p>P0 + P1</p></div></article>`}</div></section>`;
  }

  function exportBackup() {
    const backup = { app: "RepairDesk", version: VERSION, exportedAt: nowIso(), repairs, settings: settingsSnapshot(), deletedRepairs };
    downloadFile(`RepairDesk-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2));
  }

  function exportRepairsCsv() {
    const columns = ["ID", "Device", "Category", "Issue", "Status", "Priority", "Customer", "Phone", "Received", "Due", "Assignee", "Total", "Paid", "Currency"];
    const rows = repairs.map((repair) => [repair.id, repair.device, repair.category, getIssue(repair), repair.status, repair.priority, repair.customer?.name, repair.customer?.phone, repair.received, repair.target, assigneeName(repair.assignedTo), getRepairTotal(repair), repair.payments.reduce((sum, payment) => sum + toAmount(payment.amount), 0), currentCurrency]);
    downloadFile(`RepairDesk-repairs-${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${[columns, ...rows].map((row) => row.map(adminCsvCell).join(",")).join("\r\n")}`, "text/csv;charset=utf-8");
  }

  async function importBackup(file) {
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.app !== "RepairDesk" || !Array.isArray(parsed.repairs) || !parsed.settings) throw new Error(tr("invalidBackup"));
      if (!confirm(tr("confirmAction"))) return;
      repairs = parsed.repairs.map(normalizeRepair);
      deletedRepairs = Array.isArray(parsed.deletedRepairs) ? parsed.deletedRepairs : [];
      const next = normaliseSettingsSnapshot(parsed.settings);
      Object.assign(settings, next);
      currentLanguage = next.language; currentCountry = next.country; currentCurrency = next.currency;
      writeStorage(STORAGE_KEY, JSON.stringify(repairs)); writeStorage(DELETED_KEY, JSON.stringify(deletedRepairs)); writeStorage(SETTINGS_KEY, JSON.stringify(next));
      scheduleCloudSync(50); applyTranslations(); populateSettingsForm(); showToast(tr("imported"));
    } catch (error) { showToast(error.message || tr("invalidBackup")); }
  }

  async function loadPortal(token, retry = 0) {
    const screen = $("#rdPortalScreen");
    const body = $("#rdPortalBody");
    if (!screen || !body) return;
    screen.hidden = false;
    document.body.classList.add("rd-portal-mode");
    body.innerHTML = `<p>${html(tr("analyticsLoading"))}</p>`;
    try {
      if (!RepairDeskCloud?.isConfigured()) {
        if (retry < 8) return setTimeout(() => loadPortal(token, retry + 1), 350);
        throw new Error(tr("cloudNotConfigured"));
      }
      const data = await RepairDeskCloud.loadPublicRepair(token);
      const estimate = data.estimate;
      const portalMoney = (value) => formatMoneyFor(Number(value) || 0, currentLanguage, data.currency || currentCurrency);
      const documents = Array.isArray(data.documents) ? data.documents : [];
      body.innerHTML = `<p class="eyebrow"><span></span> ${html(data.workshop_name || "RepairDesk")}</p><h1>${html(tr("portalTitle"))}</h1><div class="rd-portal-device"><span class="status-badge ${html(data.status)}">${html(statusLabel(data.status))}</span><h2>${html(data.device)}</h2><p>${html(data.issue || "")}</p></div><div class="rd-portal-steps">${STANDARD_STATUSES.filter((status) => !["cancelled"].includes(status)).map((status) => `<span class="${STANDARD_STATUSES.indexOf(status) <= STANDARD_STATUSES.indexOf(data.status) ? "done" : ""}">${html(statusLabel(status))}</span>`).join("")}</div><dl class="rd-facts"><div><dt>${html(tr("receivedDate"))}</dt><dd>${html(formatDate(data.received_on))}</dd></div><div><dt>${html(tr("targetDate"))}</dt><dd>${html(formatDate(data.due_on))}</dd></div><div><dt>${html(tr("repairTotal"))}</dt><dd>${html(portalMoney(data.total))}</dd></div><div><dt>${html(tr("paid"))}</dt><dd>${html(portalMoney(data.paid))}</dd></div></dl>${estimate ? `<section class="rd-portal-estimate"><h3>${html(tr("estimate"))}</h3><strong>${html(portalMoney(estimate.amount))}</strong><p>${html(estimate.note || "")}</p><span>${html(tr(`estimate${String(estimate.status)[0].toUpperCase()}${String(estimate.status).slice(1)}`))}</span>${["draft", "sent"].includes(estimate.status) ? `<div><button class="primary-button" data-portal-response="approved">${html(tr("approve"))}</button><button class="danger-button" data-portal-response="rejected">${html(tr("reject"))}</button></div>` : ""}</section>` : ""}${documents.length ? `<section class="rd-portal-documents"><h3>${html(tr("portalDocuments"))}</h3>${documents.map((item) => `<article><strong>${html(tr(item.kind) || item.kind)}</strong><span>${html(item.number || "—")} · ${html(formatDateTime(item.created_at))}</span></article>`).join("")}</section>` : ""}<p class="rd-portal-updated">${html(tr("updatedV034"))}: ${html(formatDateTime(data.updated_at))}</p>`;
    } catch (error) { body.innerHTML = `<div class="rd-portal-error"><strong>!</strong><h2>${html(error.message || tr("authGenericError"))}</h2></div>`; }
  }

  function applyRuntimeConfig() {
    $("#rdRuntimeBanner")?.remove();
    const config = state.cloud.runtimeConfig;
    const restriction = runtimeRestriction();
    const announcement = config?.announcements?.[0];
    const notice = restriction === "maintenance"
      ? { title: tr("maintenanceMode"), message: tr("maintenanceNotice"), kind: "critical" }
      : restriction === "version"
        ? { title: tr("minimumVersion"), message: tr("updateRequiredNotice", { version: config?.flags?.minimum_app_version?.value || VERSION }), kind: "warning" }
        : announcement;
    $$('[data-view-target="inventory"]').forEach((node) => { node.hidden = !flagEnabled("inventory"); });
    document.body.classList.toggle("rd-runtime-locked", Boolean(restriction));
    if (!notice) return;
    const banner = document.createElement("aside");
    banner.id = "rdRuntimeBanner";
    banner.className = `rd-runtime-banner ${notice.kind || "info"}`;
    banner.innerHTML = `<div><strong>${html(notice.title)}</strong><span>${html(notice.message)}</span></div>${restriction ? "" : `<button type="button">×</button>`}`;
    $(".workspace")?.prepend(banner);
    $("button", banner)?.addEventListener("click", () => banner.remove());
  }

  function updateOfflineState() {
    const label = $("#rdOfflineQueueLabel");
    if (label) label.textContent = tr("pendingChanges", { count: cloudSyncPending ? 1 : 0 });
  }

  async function acceptInviteFromUrl() {
    const token = new URLSearchParams(location.search).get("invite");
    if (!token || !cloudUser || !state.cloud.workshopAccess) return;
    try {
      await RepairDeskCloud.acceptWorkshopInvite(token);
      const url = new URL(location.href); url.searchParams.delete("invite"); history.replaceState({}, "", url);
      state.cloud.workshopAccess = await RepairDeskCloud.loadWorkshop();
      showToast(tr("inviteCreated"));
      renderSettings();
    } catch (error) { showToast(error.message); }
  }

  function setCloudContext(context) {
    state.cloud = { ...state.cloud, ...context };
    applyRuntimeConfig();
    acceptInviteFromUrl();
    render(activeView);
  }

  function updateAccount({ adminVisible }) {
    const desktop = $("#adminNavButtonV034");
    const mobile = $("#adminMobileNavButtonV034");
    if (desktop) desktop.hidden = !adminVisible;
    if (mobile) mobile.hidden = !adminVisible;
  }

  function showView(view, repairId) {
    if (view === "repairs") { renderRepairs(); if (repairId) openRepairDetail(repairId); }
    else render(view);
  }

  function translate() {
    document.title = tr("pageTitleV034");
    const meta = $("meta[name='description']");
    if (meta) meta.content = tr("pageDescriptionV034");
    $$(".version-badge").forEach((badge) => { badge.textContent = VERSION; });
    render(activeView);
  }

  function onClick(event) {
    const actionNode = event.target.closest("[data-rd-action]");
    const action = actionNode?.dataset.rdAction;
    if (!action) return;
    const writeActions = new Set(["create-warranty-return", "undo-delete", "bulk-delete", "receive-order", "open-document", "create-portal", "delete-attachment", "remove-payment", "empty-trash", "restore-trash", "remove-custom-status", "save-filter", "remove-filter"]);
    if (writeActions.has(action) && !canWrite()) { event.preventDefault(); showToast(tr("workspaceReadOnly")); return; }
    const id = actionNode.dataset.id;
    const repairId = actionNode.dataset.repairId || state.detailRepairId;
    const actions = {
      "new-repair": () => openNewRepair(), "add-customer": () => openEntity("customer"), "add-device": () => openEntity("device"), "add-stock": () => openEntity("stock"), "add-supplier": () => openEntity("supplier"), "add-order": () => openEntity("order"), "add-appointment": () => openEntity("appointment"),
      "edit-customer": () => openEntity("customer", id), "edit-device": () => openEntity("device", id), "edit-stock": () => openEntity("stock", id), "edit-supplier": () => openEntity("supplier", id), "edit-order": () => openEntity("order", id), "edit-appointment": () => openEntity("appointment", id),
      "close-entity": () => $("#rdEntityDialog").close(), "open-repair": () => openRepairDetail(repairId), "close-detail": () => $("#rdDetailDialog").close(), "edit-detail": () => { $("#rdDetailDialog").close(); openEditRepair(state.detailRepairId); },
      "create-warranty-return": createWarrantyReturn, "undo-delete": undoLastDelete,
      "customer-repair": () => { const customer = findCustomer(id); state.prefillCustomerId = id; openNewRepair(); if (customer) { elements.customerNameInput.value = customer.name || ""; elements.customerPhoneInput.value = customer.phone || ""; elements.customerEmailInput.value = customer.email || ""; elements.customerAddressInput.value = customer.address || ""; } },
      "bulk-delete": bulkDelete, "receive-order": () => receiveOrder(id),
      "open-document": () => openDocument(state.detailRepairId, actionNode.dataset.kind),
      "create-portal": createPortal, "copy-portal": copyPortal,
      "open-attachment": async () => { try { window.open(await RepairDeskCloud.attachmentUrl(actionNode.dataset.path), "_blank", "noopener"); } catch (error) { showToast(error.message); } },
      "delete-attachment": () => deleteAttachment(id), "remove-payment": () => removePayment(id),
      "export-json": exportBackup, "export-repairs-csv": exportRepairsCsv, "empty-trash": emptyTrash, "restore-trash": () => restoreTrash(Number(actionNode.dataset.index)), "install-app": installApp,
      "save-filter": saveCurrentFilter, "remove-filter": () => removeSavedFilter(id),
      "remove-custom-status": () => { workspace().customStatuses = arrayBy("customStatuses").filter((item) => item.id !== id); persistWorkspace(); },
      "toggle-member": () => changeMember(id, actionNode.dataset.status),
      "admin-refresh": () => { state.adminData = null; state.adminUsers = null; state.adminWorkshops = null; loadAdmin(true); }, "admin-export": exportAdminCsv,
      "open-admin-user": () => openAdminUser(id), "close-admin-user": () => $("#rdAdminUserDialog").close(), "admin-users-more": () => loadAdvancedUsers(false),
      "admin-reset-password": async () => { await RepairDeskCloud.sendPasswordReset(actionNode.dataset.email); showToast(tr("resetSent")); }, "admin-export-user": () => exportAdminUser(id), "admin-toggle-user": () => toggleAdminUser(id, actionNode.dataset.status), "admin-delete-user": () => deleteAdminUser(id, actionNode.dataset.email),
      "save-admin-feedback": () => saveAdminFeedback(id), "save-feature-flag": () => saveFeatureFlag(actionNode.closest("[data-feature-flag]")),
      "enable-mfa": startMfa, "disable-mfa": () => disableMfa(id),
    };
    if (actions[action]) { event.preventDefault(); Promise.resolve(actions[action]()).catch((error) => showToast(error.message || tr("authGenericError"))); }
  }

  function onChange(event) {
    if (event.target.matches("[data-rd-select-repair]")) {
      const id = event.target.dataset.rdSelectRepair;
      if (event.target.checked) state.selectedRepairs.add(id); else state.selectedRepairs.delete(id);
      renderRepairs();
    } else if (event.target.id === "rdRepairPriority") { state.repairPriority = event.target.value; renderRepairs(); }
    else if (event.target.id === "rdRepairAssignee") { state.repairAssignee = event.target.value; renderRepairs(); }
    else if (event.target.id === "rdSavedFilter") { applySavedFilter(event.target.value); }
    else if (event.target.id === "rdBulkStatus" && event.target.value) { if (canWrite()) bulkUpdate("status", event.target.value); else showToast(tr("workspaceReadOnly")); }
    else if (event.target.id === "rdBulkAssignee" && event.target.value) { if (canWrite()) bulkUpdate("assignedTo", event.target.value); else showToast(tr("workspaceReadOnly")); }
    else if (event.target.matches("[data-rd-detail-status]")) changeRepairStatus(event.target.value);
    else if (event.target.id === "rdAttachmentInput") { if (canWrite()) uploadAttachments(event.target.files); else showToast(tr("workspaceReadOnly")); }
    else if (event.target.id === "rdImportInput" && event.target.files[0]) importBackup(event.target.files[0]);
    else if (event.target.id === "rdReportPeriod") renderReports();
    else if (event.target.id === "rdAdminRange") changeAdminRange(event.target.value);
    else if (["rdAdminFrom", "rdAdminTo"].includes(event.target.id)) { state.adminFrom = $("#rdAdminFrom").value; state.adminTo = $("#rdAdminTo").value; if (state.adminFrom && state.adminTo) { state.adminData = null; loadAdmin(true); } }
    else if (event.target.matches("[data-member-role]")) changeMember(event.target.dataset.memberRole, "active", event.target.value);
  }

  function onInput(event) {
    if (event.target.id === "rdRepairSearch") { state.repairSearch = event.target.value; renderRepairs(); requestAnimationFrame(() => { const input = $("#rdRepairSearch"); input?.focus(); input?.setSelectionRange(input.value.length, input.value.length); }); }
    else if (event.target.id === "rdAdminUserSearch") { state.adminUserQuery = event.target.value; clearTimeout(state.adminSearchTimer); state.adminSearchTimer = setTimeout(() => loadAdvancedUsers(true), 280); }
  }

  function onSubmit(event) {
    const workshopForms = new Set(["rdEntityForm", "rdDiagnosisForm", "rdEstimateForm", "rdPaymentForm", "rdInviteForm", "rdStatusForm", "rdDocumentSettingsForm"]);
    if (workshopForms.has(event.target.id) && !canWrite()) { event.preventDefault(); showToast(tr("workspaceReadOnly")); return; }
    if (event.target.id === "rdEntityForm") return submitEntity(event);
    if (event.target.id === "rdDiagnosisForm") { event.preventDefault(); const repair = repairs.find((item) => item.id === state.detailRepairId); repair.diagnosis = formValue(event.target, "diagnosis"); repair.updatedAt = nowIso(); addHistory(repair, "note", { note: repair.diagnosis }); persistRepairs({ renderView: false }); renderRepairDetail(); showToast(tr("saved")); }
    else if (event.target.id === "rdEstimateForm") saveEstimate(event);
    else if (event.target.id === "rdPaymentForm") addPayment(event);
    else if (event.target.id === "rdInviteForm") createInvite(event);
    else if (event.target.id === "rdStatusForm") addCustomStatus(event);
    else if (event.target.id === "rdDocumentSettingsForm") saveDocumentSettings(event);
    else if (event.target.id === "rdSupportNoteForm") saveSupportNote(event);
    else if (event.target.id === "rdAnnouncementForm") publishAnnouncement(event);
    else if (event.target.id === "rdMfaVerifyForm") verifyMfa(event);
  }

  function bulkUpdate(key, value) {
    repairs.forEach((repair) => { if (state.selectedRepairs.has(repair.id)) { const previous = repair[key]; repair[key] = value; repair.updatedAt = nowIso(); if (key === "status") addHistory(repair, "status", { from: previous, to: value }); } });
    state.selectedRepairs.clear(); persistRepairs();
  }

  function saveCurrentFilter() {
    const name = String(prompt(tr("filterName")) || "").trim().slice(0, 60);
    if (!name) return;
    const filter = {
      id: createId(), name, search: state.repairSearch, priority: state.repairPriority,
      assignee: state.repairAssignee, mode: state.repairMode, createdAt: nowIso(),
    };
    workspace().savedFilters.unshift(filter);
    workspace().savedFilters = workspace().savedFilters.slice(0, 30);
    state.savedFilterId = filter.id;
    persistWorkspace();
  }

  function applySavedFilter(id) {
    state.savedFilterId = id;
    const filter = arrayBy("savedFilters").find((item) => item.id === id);
    if (filter) {
      state.repairSearch = String(filter.search || "");
      state.repairPriority = String(filter.priority || "all");
      state.repairAssignee = String(filter.assignee || "all");
      state.repairMode = filter.mode === "list" ? "list" : "kanban";
    }
    renderRepairs();
  }

  function removeSavedFilter(id) {
    workspace().savedFilters = arrayBy("savedFilters").filter((item) => item.id !== id);
    state.savedFilterId = "";
    persistWorkspace();
  }

  function bulkDelete() {
    if (!confirm(tr("confirmAction"))) return;
    const selected = repairs.filter((repair) => state.selectedRepairs.has(repair.id));
    selected.forEach((repair) => { workspace().trash.unshift({ kind: "repair", deletedAt: nowIso(), data: repair }); deletedRepairs.push({ id: repair.id, deletedAt: nowIso() }); });
    repairs = repairs.filter((repair) => !state.selectedRepairs.has(repair.id)); state.selectedRepairs.clear(); saveRepairs(); persistWorkspace();
  }

  function changeRepairStatus(value) {
    const repair = repairs.find((item) => item.id === state.detailRepairId);
    if (!repair || !canWrite()) return;
    const previous = repair.status; repair.status = value; repair.updatedAt = nowIso(); if (value === "completed") repair.completedAt = nowIso(); addHistory(repair, "status", { from: previous, to: value }); persistRepairs({ renderView: false }); renderRepairDetail(); renderRepairs();
  }

  function saveEstimate(event) {
    event.preventDefault(); const repair = repairs.find((item) => item.id === state.detailRepairId); if (!repair) return;
    const data = new FormData(event.target); repair.estimate = { ...(repair.estimate || {}), id: repair.estimate?.id || createId(), amount: toAmount(data.get("amount")), status: String(data.get("status")), note: String(data.get("note") || "").slice(0, 2000), createdAt: repair.estimate?.createdAt || nowIso(), updatedAt: nowIso() }; repair.updatedAt = nowIso(); addHistory(repair, "updated", { section: "estimate" }); persistRepairs({ renderView: false }); renderRepairDetail(); showToast(tr("saved"));
  }

  function addPayment(event) {
    event.preventDefault(); const repair = repairs.find((item) => item.id === state.detailRepairId); if (!repair) return; const data = new FormData(event.target); const amount = toAmount(data.get("amount")); if (!amount) return;
    repair.payments.unshift({ id: createId(), amount, method: String(data.get("method")), status: "paid", paidAt: nowIso(), createdAt: nowIso() }); repair.updatedAt = nowIso(); addHistory(repair, "note", { note: `${tr("payments")}: ${formatMoney(amount)}` }); persistRepairs({ renderView: false }); renderRepairDetail();
  }

  function removePayment(id) { const repair = repairs.find((item) => item.id === state.detailRepairId); if (!repair || !confirm(tr("confirmAction"))) return; repair.payments = repair.payments.filter((item) => item.id !== id); repair.updatedAt = nowIso(); persistRepairs({ renderView: false }); renderRepairDetail(); }

  function createPortal() { const repair = repairs.find((item) => item.id === state.detailRepairId); if (!repair) return; repair.portalToken = `${createId()}${createId().replaceAll("-", "")}`; repair.updatedAt = nowIso(); persistRepairs({ renderView: false }); performCloudSync({ notify: false }); renderRepairDetail(); }
  function copyPortal() { const repair = repairs.find((item) => item.id === state.detailRepairId); if (repair?.portalToken) copyText(portalUrl(repair.portalToken)).then(() => showToast(tr("portalCopied"))); }
  async function deleteAttachment(id) { const repair = repairs.find((item) => item.id === state.detailRepairId); const attachment = repair?.attachments.find((item) => item.id === id); if (!attachment || !confirm(tr("confirmAction"))) return; await RepairDeskCloud.deleteAttachment(attachment.storagePath); repair.attachments = repair.attachments.filter((item) => item.id !== id); persistRepairs({ renderView: false }); renderRepairDetail(); }

  function receiveOrder(id) { const order = arrayBy("purchaseOrders").find((item) => item.id === id); if (!order) return; order.status = "received"; order.receivedAt = nowIso(); let item = arrayBy("inventory").find((stock) => (order.sku && stock.sku === order.sku) || stock.name === order.itemName); if (item) item.quantity = Number(item.quantity || 0) + Number(order.quantity || 0); else if (order.itemName) workspace().inventory.unshift({ id: createId(), name: order.itemName, sku: order.sku || "", quantity: Number(order.quantity || 0), minimumQuantity: 0, cost: toAmount(order.unitCost), price: toAmount(order.unitCost), supplierId: order.supplierId, createdAt: nowIso(), updatedAt: nowIso() }); persistWorkspace(); }

  function restoreTrash(index) { const item = workspace().trash[index]; if (!item) return; if (item.kind === "repair") { repairs = [normalizeRepair(item.data), ...repairs.filter((repair) => repair.id !== item.data.id)]; deletedRepairs = deletedRepairs.filter((row) => row.id !== item.data.id); saveRepairs(); } workspace().trash.splice(index, 1); persistWorkspace(); showToast(tr("restored")); }
  function emptyTrash() { if (!confirm(tr("confirmAction"))) return; workspace().trash = []; persistWorkspace(); }

  async function createInvite(event) { event.preventDefault(); const email = formValue(event.target, "email"); const inviteRole = formValue(event.target, "role"); const result = await RepairDeskCloud.createWorkshopInvite(email, inviteRole); const url = new URL(location.href); url.search = ""; url.searchParams.set("invite", result.token); await copyText(url.href); showToast(tr("inviteCreated")); state.cloud.workshopAccess = await RepairDeskCloud.loadWorkshop(); renderSettings(); }
  async function changeMember(id, status, nextRole = "") { const member = teamMembers().find((item) => item.user_id === id); await RepairDeskCloud.updateWorkshopMember(id, nextRole || member?.role || "technician", status); state.cloud.workshopAccess = await RepairDeskCloud.loadWorkshop(); renderSettings(); }
  function addCustomStatus(event) { event.preventDefault(); const name = formValue(event.target, "name"); if (!name) return; workspace().customStatuses.push({ id: createId(), key: `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`, name }); persistWorkspace(); }
  function saveDocumentSettings(event) { event.preventDefault(); const data = new FormData(event.target); workspace().documentSettings = { logoUrl: String(data.get("logoUrl") || "").slice(0, 500), defaultWarrantyDays: Math.min(3650, Math.max(0, Number(data.get("defaultWarrantyDays")) || 90)), receiptTitle: String(data.get("receiptTitle") || "").slice(0, 120), invoiceTitle: String(data.get("invoiceTitle") || "").slice(0, 120), emailSubject: String(data.get("emailSubject") || "").slice(0, 200), emailMessage: String(data.get("emailMessage") || "").slice(0, 2000), footer: String(data.get("footer") || "").slice(0, 1000) }; persistWorkspace(); showToast(tr("saved")); }

  function changeAdminRange(value) { if (value === "custom") { state.adminRange = 0; $("#rdAdminFrom").hidden = false; $("#rdAdminTo").hidden = false; return; } state.adminRange = Number(value); state.adminFrom = ""; state.adminTo = ""; state.adminData = null; loadAdmin(true); }
  async function exportAdminUser(id) { const data = await RepairDeskCloud.exportAdminUser(id); downloadFile(`RepairDesk-user-${id}.json`, JSON.stringify(data, null, 2)); }
  async function toggleAdminUser(id, status) { if (!confirm(tr("confirmAction"))) return; await RepairDeskCloud.setAdminUserStatus(id, status); if (state.adminDetail?.profile) state.adminDetail.profile.account_status = status; await loadAdvancedUsers(true); renderAdminUserDetail(); }
  async function deleteAdminUser(id, email) { const typed = prompt(`${tr("confirmDeleteEmail")}:\n${email}`); if (typed !== email) return; await RepairDeskCloud.deleteAdminUser(id, email); $("#rdAdminUserDialog").close(); state.adminData = null; state.adminUsers = null; await loadAdmin(true); }
  async function saveSupportNote(event) { event.preventDefault(); const note = formValue(event.target, "note"); if (!note) return; await RepairDeskCloud.addAdminSupportNote(state.adminDetail.user.id, note); state.adminDetail = await RepairDeskCloud.loadAdminUserDetail(state.adminDetail.user.id); renderAdminUserDetail(); }
  async function saveAdminFeedback(id) { const card = $(`[data-admin-feedback="${CSS.escape(String(id))}"]`); const value = (name) => card.querySelector(`[name="${name}"]`)?.value || ""; await RepairDeskCloud.updateAdminFeedback(id, { status: value("status"), priority: value("priority"), category: value("category"), adminNote: value("adminNote"), releaseVersion: value("releaseVersion") }); state.adminData = await RepairDeskCloud.loadAdminDashboard(...Object.values(adminDateRange())); renderAdminContent(); showToast(tr("saved")); }
  async function saveFeatureFlag(card) { const key = card.dataset.featureFlag; await RepairDeskCloud.setFeatureFlag(key, card.querySelector('[name="enabled"]').checked, Number(card.querySelector('[name="rollout"]').value), state.adminData.flags.find((flag) => flag.key === key)?.description || "", card.querySelector('[name="value"]')?.value || ""); state.adminData = null; await loadAdmin(true); showToast(tr("saved")); }
  async function publishAnnouncement(event) { event.preventDefault(); const data = new FormData(event.target); await RepairDeskCloud.publishAnnouncement({ title: data.get("title"), message: data.get("message"), kind: data.get("kind"), audience: data.get("audience"), endsAt: data.get("endsAt") || null }); state.adminData = null; await loadAdmin(true); showToast(tr("created")); }
  async function verifyMfa(event) { event.preventDefault(); await RepairDeskCloud.verifyMfa(state.pendingMfa.id, formValue(event.target, "code")); state.pendingMfa = null; await RepairDeskCloud.recordAdminAction("mfa_enabled", "security", cloudUser.id, {}); loadMfaState(); showToast(tr("twoFactorEnabled")); }
  async function disableMfa(id) { if (!confirm(tr("confirmAction"))) return; await RepairDeskCloud.unenrollMfa(id); await RepairDeskCloud.recordAdminAction("mfa_disabled", "security", cloudUser.id, {}); loadMfaState(); }
  async function installApp() { if (!state.pendingInstall) return; state.pendingInstall.prompt(); await state.pendingInstall.userChoice; state.pendingInstall = null; renderSettings(); }

  function onPointerDrag() {
    document.addEventListener("dragstart", (event) => { const card = event.target.closest("[data-repair-id]"); if (card?.draggable) event.dataTransfer.setData("text/repair-id", card.dataset.repairId); });
    document.addEventListener("dragover", (event) => { if (event.target.closest("[data-drop-status]")) event.preventDefault(); });
    document.addEventListener("drop", (event) => { const column = event.target.closest("[data-drop-status]"); if (!column) return; event.preventDefault(); const id = event.dataTransfer.getData("text/repair-id"); const repair = repairs.find((item) => item.id === id); if (!repair || !canWrite()) return; const previous = repair.status; repair.status = column.dataset.dropStatus; repair.updatedAt = nowIso(); if (repair.status === "completed") repair.completedAt = nowIso(); addHistory(repair, "status", { from: previous, to: repair.status }); persistRepairs(); });
  }

  function onKeyboard(event) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const input = event.target.matches("input,textarea,select,[contenteditable]");
    if (event.key === "/" && !input) { event.preventDefault(); showView("repairs"); requestAnimationFrame(() => $("#rdRepairSearch")?.focus()); return; }
    if ((event.key === "n" || event.key === "N") && !input) { event.preventDefault(); openNewRepair(); return; }
    if ((event.key === "g" || event.key === "G") && !input) { state.lastShortcut = "g"; setTimeout(() => { state.lastShortcut = ""; }, 1200); return; }
    if (state.lastShortcut === "g" && !input) { const target = { r: "repairs", c: "customers", d: "devices", i: "inventory" }[event.key.toLowerCase()]; if (target) { event.preventDefault(); state.lastShortcut = ""; showView(target); } }
  }

  function init() {
    if (state.initialised) return;
    state.initialised = true;
    injectNavigation(); injectViews(); injectDashboard(); injectIntakeFields(); injectSettingsExtensions(); injectDialogs(); injectAdmin(); setupSignatureCanvas();
    $$(".version-badge").forEach((badge) => { badge.textContent = VERSION; });
    $("#rdClearSignature")?.addEventListener("click", clearSignature);
    $("#repairForm")?.addEventListener("input", () => { clearTimeout(state.draftTimer); state.draftTimer = setTimeout(saveDraft, 250); });
    document.addEventListener("click", onClick);
    document.addEventListener("change", onChange);
    document.addEventListener("input", onInput);
    document.addEventListener("submit", onSubmit);
    document.addEventListener("click", (event) => { const mode = event.target.closest("[data-rd-mode]")?.dataset.rdMode; if (mode) { state.repairMode = mode; renderRepairs(); } const tab = event.target.closest("[data-inventory-tab]")?.dataset.inventoryTab; if (tab) { state.inventoryTab = tab; renderInventory(); } const detail = event.target.closest("[data-detail-tab]")?.dataset.detailTab; if (detail) { state.detailTab = detail; renderRepairDetail(); } const adminTab = event.target.closest("[data-admin-tab]")?.dataset.adminTab; if (adminTab) { state.adminTab = adminTab; if (adminTab === "users" && !state.adminUsers) loadAdvancedUsers(true); if (adminTab === "workshops" && !state.adminWorkshops) loadAdminWorkshops(); renderAdmin(); } const filter = event.target.closest("[data-admin-user-filter]")?.dataset.adminUserFilter; if (filter) { state.adminUserFilter = filter; loadAdvancedUsers(true); } const granularity = event.target.closest("[data-admin-granularity]")?.dataset.adminGranularity; if (granularity) { state.adminGranularity = granularity; renderAdminContent(); } const response = event.target.closest("[data-portal-response]")?.dataset.portalResponse; if (response) RepairDeskCloud.respondToEstimate(new URLSearchParams(location.search).get("portal"), response).then(() => loadPortal(new URLSearchParams(location.search).get("portal"))).catch((error) => showToast(error.message)); });
    onPointerDrag(); document.addEventListener("keydown", onKeyboard);
    window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); state.pendingInstall = event; renderSettings(); });
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
    const portal = new URLSearchParams(location.search).get("portal");
    if (portal) setTimeout(() => loadPortal(portal), 450);
    render("overview");
  }
})();
