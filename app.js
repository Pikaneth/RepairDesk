const STORAGE_KEY = "repairdesk.repairs.v1";
const THEME_KEY = "repairdesk.theme";

const statusLabels = {
  waiting: "Waiting",
  "in-progress": "In progress",
  completed: "Completed",
};

const elements = {
  activeCount: document.querySelector("#activeCount"),
  activeHint: document.querySelector("#activeHint"),
  waitingCount: document.querySelector("#waitingCount"),
  completedCount: document.querySelector("#completedCount"),
  completedHint: document.querySelector("#completedHint"),
  totalSpent: document.querySelector("#totalSpent"),
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
};

const moneyFormatter = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

let repairs = loadRepairs();
let pendingDeleteId = null;
let toastTimer = null;

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function dateFromToday(offset) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function sampleRepairs() {
  return [
    {
      id: createId(),
      device: "Samsung Galaxy S22 Ultra",
      category: "Smartphone",
      issue: "Water damage and damaged display",
      serial: "",
      status: "completed",
      received: "2026-07-17",
      target: "2026-07-22",
      labour: 0,
      parts: [
        { id: createId(), name: "Used AMOLED display", cost: 16 },
        { id: createId(), name: "Burgundy housing", cost: 21 },
        { id: createId(), name: "B-7000 adhesive", cost: 4 },
      ],
      notes: "Mainboard cleaned and inspected. Display and housing replaced.",
      createdAt: "2026-07-17T18:20:00.000Z",
      updatedAt: "2026-07-22T17:10:00.000Z",
    },
    {
      id: createId(),
      device: "iPhone 12 mini",
      category: "Smartphone",
      issue: "Battery replacement and charging check",
      serial: "",
      status: "in-progress",
      received: dateFromToday(-3),
      target: dateFromToday(2),
      labour: 18,
      parts: [{ id: createId(), name: "Replacement battery", cost: 29.9 }],
      notes: "Battery fitted. Running a full charge cycle before final checks.",
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: createId(),
      device: "Lenovo ThinkPad X1 Carbon",
      category: "Laptop",
      issue: "USB-C port disconnects under load",
      serial: "PF4X-21K7",
      status: "waiting",
      received: dateFromToday(-1),
      target: dateFromToday(5),
      labour: 25,
      parts: [{ id: createId(), name: "USB-C daughterboard", cost: 34.5 }],
      notes: "Replacement board ordered. Charger and cable tested successfully.",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

function normalizeRepair(repair) {
  const validStatus = Object.hasOwn(statusLabels, repair.status) ? repair.status : "waiting";
  const parts = Array.isArray(repair.parts)
    ? repair.parts.map((part) => ({
        id: part.id || createId(),
        name: String(part.name || "Part"),
        cost: toAmount(part.cost),
      }))
    : [];

  return {
    id: repair.id || createId(),
    device: String(repair.device || "Unnamed device"),
    category: String(repair.category || "Other"),
    issue: String(repair.issue || "No issue recorded"),
    serial: String(repair.serial || ""),
    status: validStatus,
    received: String(repair.received || ""),
    target: String(repair.target || ""),
    labour: toAmount(repair.labour),
    parts,
    notes: String(repair.notes || ""),
    createdAt: repair.createdAt || new Date().toISOString(),
    updatedAt: repair.updatedAt || new Date().toISOString(),
  };
}

function loadRepairs() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const samples = sampleRepairs();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
      return samples;
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map(normalizeRepair) : sampleRepairs();
  } catch {
    return sampleRepairs();
  }
}

function saveRepairs() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(repairs));
  } catch {
    showToast("Changes could not be saved in this browser.");
  }
}

function toAmount(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : 0;
}

function getRepairTotal(repair) {
  const partsTotal = repair.parts.reduce((sum, part) => sum + toAmount(part.cost), 0);
  return Math.round((partsTotal + toAmount(repair.labour)) * 100) / 100;
}

function formatMoney(value) {
  return moneyFormatter.format(toAmount(value));
}

function formatDate(value) {
  if (!value) return "Not set";

  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "Not set" : dateFormatter.format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pluralise(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function render() {
  renderStats();
  renderRepairCards();
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
  elements.activeHint.textContent = active
    ? `${pluralise(inProgress, "in progress", "in progress")} · ${pluralise(waiting, "waiting", "waiting")}`
    : "No repairs in progress";
  elements.completedHint.textContent = completed ? `${pluralise(completed, "repair")} finished` : "Finished repairs";
}

function filteredRepairs() {
  const query = elements.searchInput.value.trim().toLocaleLowerCase();
  const status = elements.statusFilter.value;

  const matches = repairs.filter((repair) => {
    const searchable = [
      repair.device,
      repair.category,
      repair.issue,
      repair.serial,
      repair.notes,
      ...repair.parts.map((part) => part.name),
    ]
      .join(" ")
      .toLocaleLowerCase();

    const matchesQuery = !query || searchable.includes(query);
    const matchesStatus = status === "all" || repair.status === status;
    return matchesQuery && matchesStatus;
  });

  return matches.sort((first, second) => {
    switch (elements.sortSelect.value) {
      case "oldest":
        return new Date(first.createdAt) - new Date(second.createdAt);
      case "cost-high":
        return getRepairTotal(second) - getRepairTotal(first);
      case "cost-low":
        return getRepairTotal(first) - getRepairTotal(second);
      case "newest":
      default:
        return new Date(second.createdAt) - new Date(first.createdAt);
    }
  });
}

function renderRepairCards() {
  const visibleRepairs = filteredRepairs();
  const hasFilters = elements.searchInput.value.trim() || elements.statusFilter.value !== "all";

  elements.repairGrid.replaceChildren();
  elements.resultCount.textContent = pluralise(visibleRepairs.length, "repair");
  elements.emptyState.hidden = visibleRepairs.length > 0;
  elements.repairGrid.hidden = visibleRepairs.length === 0;

  if (!visibleRepairs.length) {
    elements.emptyTitle.textContent = hasFilters ? "No matching repairs" : "No repairs yet";
    elements.emptyCopy.textContent = hasFilters
      ? "Try a different search or change the status filter."
      : "Add your first device to start tracking the repair.";
    elements.emptyAddButton.hidden = Boolean(hasFilters);
    return;
  }

  visibleRepairs.forEach((repair) => {
    const card = document.createElement("article");
    card.className = "repair-card";
    card.dataset.id = repair.id;
    card.dataset.status = repair.status;

    const partsLabel = repair.parts.length ? pluralise(repair.parts.length, "part") : "No parts";
    const dateLabel = repair.status === "completed" ? "Completed by" : "Target date";

    card.innerHTML = `
      <div class="repair-card-top">
        <div>
          <p class="device-type">${escapeHtml(repair.category)}</p>
          <h3>${escapeHtml(repair.device)}</h3>
        </div>
        <span class="status-badge ${escapeHtml(repair.status)}">${escapeHtml(statusLabels[repair.status])}</span>
      </div>
      <p class="repair-issue">${escapeHtml(repair.issue)}</p>
      <div class="repair-meta">
        <div class="meta-item">
          <span>Received</span>
          <strong>${escapeHtml(formatDate(repair.received))}</strong>
        </div>
        <div class="meta-item">
          <span>${dateLabel}</span>
          <strong>${escapeHtml(formatDate(repair.target))}</strong>
        </div>
      </div>
      <div class="repair-card-bottom">
        <div class="repair-cost">
          <span>${escapeHtml(partsLabel)}</span>
          <strong>${escapeHtml(formatMoney(getRepairTotal(repair)))}</strong>
        </div>
        <div class="card-actions">
          <button class="card-button edit-button" type="button" data-action="edit" aria-label="Edit ${escapeHtml(repair.device)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-.8 4 4-.8L18 8.4 15.6 6 4 16Zm9.8-8.2 2.4 2.4" /></svg>
            <span>Edit</span>
          </button>
          <button class="card-button delete-button" type="button" data-action="delete" aria-label="Delete ${escapeHtml(repair.device)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>
            <span>Delete</span>
          </button>
        </div>
      </div>
    `;

    elements.repairGrid.append(card);
  });
}

function resetFormErrors() {
  [elements.deviceInput, elements.issueInput].forEach((input) => {
    input.closest(".field").classList.remove("has-error");
  });
  elements.deviceError.textContent = "";
  elements.issueError.textContent = "";
}

function openNewRepair() {
  elements.repairForm.reset();
  resetFormErrors();
  elements.repairId.value = "";
  elements.dialogTitle.textContent = "New repair";
  elements.submitButtonLabel.textContent = "Save repair";
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
  elements.dialogTitle.textContent = "Edit repair";
  elements.submitButtonLabel.textContent = "Update repair";
  elements.deviceInput.value = repair.device;
  elements.categoryInput.value = repair.category;
  elements.statusInput.value = repair.status;
  elements.issueInput.value = repair.issue;
  elements.serialInput.value = repair.serial;
  elements.receivedInput.value = repair.received;
  elements.targetInput.value = repair.target;
  elements.targetInput.min = repair.received;
  elements.labourInput.value = repair.labour;
  elements.notesInput.value = repair.notes;
  elements.partsList.replaceChildren();

  if (repair.parts.length) {
    repair.parts.forEach(addPartRow);
  } else {
    addPartRow();
  }

  updateFormTotal();
  elements.repairDialog.showModal();
  requestAnimationFrame(() => elements.deviceInput.focus());
}

function closeRepairDialog() {
  elements.repairDialog.close();
}

function addPartRow(part = {}) {
  const fragment = elements.partRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".part-row");
  const nameInput = fragment.querySelector(".part-name");
  const costInput = fragment.querySelector(".part-cost");

  row.dataset.partId = part.id || createId();
  nameInput.value = part.name || "";
  costInput.value = toAmount(part.cost);
  elements.partsList.append(fragment);
}

function readParts() {
  return [...elements.partsList.querySelectorAll(".part-row")]
    .map((row) => {
      const name = row.querySelector(".part-name").value.trim();
      const cost = toAmount(row.querySelector(".part-cost").value);
      return {
        id: row.dataset.partId || createId(),
        name: name || "Part",
        cost,
        isEmpty: !name && cost === 0,
      };
    })
    .filter((part) => !part.isEmpty)
    .map(({ isEmpty, ...part }) => part);
}

function updateFormTotal() {
  const partsTotal = [...elements.partsList.querySelectorAll(".part-cost")].reduce(
    (sum, input) => sum + toAmount(input.value),
    0,
  );
  const total = partsTotal + toAmount(elements.labourInput.value);
  elements.formTotal.textContent = formatMoney(total);
}

function validateRepairForm() {
  resetFormErrors();
  let isValid = true;

  if (!elements.deviceInput.value.trim()) {
    elements.deviceInput.closest(".field").classList.add("has-error");
    elements.deviceError.textContent = "Enter the device model.";
    isValid = false;
  }

  if (!elements.issueInput.value.trim()) {
    elements.issueInput.closest(".field").classList.add("has-error");
    elements.issueError.textContent = "Describe the repair issue.";
    isValid = false;
  }

  if (!elements.receivedInput.value) {
    elements.receivedInput.focus();
    isValid = false;
  }

  if (!isValid) {
    const firstError = elements.repairForm.querySelector(".has-error input");
    if (firstError) firstError.focus();
  }

  return isValid;
}

function saveRepairFromForm(event) {
  event.preventDefault();
  if (!validateRepairForm()) return;

  const existingId = elements.repairId.value;
  const existing = repairs.find((repair) => repair.id === existingId);
  const now = new Date().toISOString();
  const repair = normalizeRepair({
    id: existingId || createId(),
    device: elements.deviceInput.value.trim(),
    category: elements.categoryInput.value,
    status: elements.statusInput.value,
    issue: elements.issueInput.value.trim(),
    serial: elements.serialInput.value.trim(),
    received: elements.receivedInput.value,
    target: elements.targetInput.value,
    labour: elements.labourInput.value,
    parts: readParts(),
    notes: elements.notesInput.value.trim(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });

  if (existing) {
    repairs = repairs.map((item) => (item.id === repair.id ? repair : item));
  } else {
    repairs = [repair, ...repairs];
  }

  saveRepairs();
  render();
  closeRepairDialog();
  showToast(existing ? "Repair updated." : "Repair added to the queue.");
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
  showToast("Repair deleted.");
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
  elements.themeLabel.textContent = isDark ? "Light mode" : "Dark mode";
  document.querySelector('meta[name="theme-color"]').content = isDark ? "#111714" : "#f4f2ed";
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
}

function initialiseTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  setTheme(savedTheme || systemTheme);
}

function toggleTheme() {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
}

function closeDialogFromBackdrop(event) {
  const dialog = event.currentTarget;
  const bounds = dialog.getBoundingClientRect();
  const outside =
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom;

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

elements.receivedInput.addEventListener("change", () => {
  elements.targetInput.min = elements.receivedInput.value;
  if (elements.targetInput.value && elements.targetInput.value < elements.receivedInput.value) {
    elements.targetInput.value = elements.receivedInput.value;
  }
});

elements.dialogTitle.closest(".dialog-header").addEventListener("click", (event) => {
  event.stopPropagation();
});

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
  if (!button) return;

  const card = button.closest(".repair-card");
  if (!card) return;

  if (button.dataset.action === "edit") {
    openEditRepair(card.dataset.id);
  } else if (button.dataset.action === "delete") {
    requestDelete(card.dataset.id);
  }
});

elements.repairDialog.addEventListener("close", resetFormErrors);
elements.confirmDialog.addEventListener("close", () => {
  pendingDeleteId = null;
});

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((link) => link.classList.remove("active"));
    item.classList.add("active");
  });
});

initialiseTheme();
render();
