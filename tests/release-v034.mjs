import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), "utf8");
const app = read("app.js");
const cloud = read("cloud.js");
const ui = read("v034.js");
const schema = read("supabase/schema.sql");
const html = read("index.html");
const manifest = JSON.parse(read("manifest.webmanifest"));
const serviceWorker = read("sw.js");

function has(source, pattern, label) {
  assert.match(source, pattern, `${label} is missing from the v0.3.4 release`);
}

// Owner console P0/P1 contract.
for (const tab of ["overview", "users", "workshops", "analytics", "feedback", "system", "security", "releases"]) {
  has(ui, new RegExp(`adminTab[\\s\\S]*${tab}|data-admin-tab=.[^>]*${tab}`, "i"), `Owner ${tab} section`);
}
has(ui, /adminDateRange[\s\S]*previous|previous[\s\S]*compareValue/i, "Date comparison");
has(ui, /active_today[\s\S]*active_7d[\s\S]*active_30d/i, "DAU, WAU and MAU metrics");
has(ui, /returning_period[\s\S]*churned_period[\s\S]*retention/i, "Return, churn and retention metrics");
has(ui, /funnelChart[\s\S]*first_repair/i, "Registration funnel");
has(ui, /loadAdminUserDetail[\s\S]*sendPasswordReset[\s\S]*setAdminUserStatus[\s\S]*deleteAdminUser/i, "Owner user controls");
has(ui, /product_usage[\s\S]*event_breakdown[\s\S]*version_breakdown/i, "Product and version analytics");
has(ui, /sync_success_rate_30d[\s\S]*database_bytes[\s\S]*attachment_bytes/i, "System health");
has(ui, /updateAdminFeedback[\s\S]*adminNote[\s\S]*releaseVersion/i, "Feedback workflow");
has(ui, /setFeatureFlag/i, "Feature-flag controls");
has(ui, /minimum_app_version/i, "Minimum-version control");
has(ui, /publishAnnouncement/i, "Announcement controls");
has(ui, /listMfaFactors[\s\S]*enrollMfa[\s\S]*verifyMfa[\s\S]*unenrollMfa/i, "Owner MFA controls");
has(ui, /adminData\.audit[\s\S]*adminData\.releases/i, "Audit and releases views");
has(ui, /Snapshot[\s\S]*8\.5 MB[\s\S]*5 MB \/ file[\s\S]*120 req/i, "Operational limits");

// Workshop P0/P1 contract.
for (const view of ["overview", "repairs", "customers", "devices", "inventory", "calendar", "reports", "settings"]) {
  has(ui, new RegExp(`data-view-target="${view}"`, "i"), `Workshop ${view} navigation`);
}
has(ui, /renderTodayDashboard[\s\S]*overdue[\s\S]*lowStock/i, "Today dashboard");
has(ui, /STANDARD_STATUSES[\s\S]*data-drop-status[\s\S]*dragstart[\s\S]*drop/i, "Kanban workflow");
has(ui, /repairPriority[\s\S]*repairAssignee[\s\S]*savedFilters[\s\S]*saveCurrentFilter/i, "Repair filters and assignments");
has(ui, /renderCustomers[\s\S]*lifetimeValue[\s\S]*renderDevices[\s\S]*imei/i, "Customer and device registries");
has(ui, /rdImeiInput[\s\S]*rdConditionInput[\s\S]*rdAccessoriesInput[\s\S]*rdIntakeAcceptedInput[\s\S]*rdSignatureCanvas/i, "Complete intake");
has(ui, /renderInventory[\s\S]*suppliers[\s\S]*purchaseOrders[\s\S]*tracking[\s\S]*receiveOrder/i, "Inventory and purchasing");
has(ui, /renderCalendar[\s\S]*appointments[\s\S]*deadline/i, "Calendar");
has(ui, /detailEstimate[\s\S]*detailPayments/i, "Estimate and payment views");
has(ui, /saveEstimate[\s\S]*addPayment/i, "Estimate and payment writes");
has(ui, /detailPortal[\s\S]*renderQr[\s\S]*createPortal/i, "Customer portal and QR");
has(ui, /createWarrantyReturn[\s\S]*parentRepairId/i, "Warranty returns");
has(ui, /createWorkshopInvite[\s\S]*updateWorkshopMember/i, "Team invitations and member updates");
has(ui, /manager[\s\S]*technician[\s\S]*viewer/i, "Team roles");
has(ui, /documentSettings[\s\S]*logoUrl[\s\S]*receiptTitle[\s\S]*invoiceTitle[\s\S]*footer/i, "Document branding");
has(ui, /exportBackup[\s\S]*exportRepairsCsv[\s\S]*importBackup/i, "Backup import and exports");
has(ui, /undoLastDelete[\s\S]*emptyTrash/i, "Trash and undo");
has(ui, /saveDraft/i, "Intake autosave");
has(ui, /onKeyboard/i, "Keyboard shortcuts");
has(ui, /beforeinstallprompt[\s\S]*serviceWorker/i, "PWA installation");
has(ui, /selectedRepairs[\s\S]*bulkUpdate[\s\S]*bulkDelete/i, "Bulk actions");
has(ui, /if \(!settings\.workspace \|\| typeof settings\.workspace !== "object"\)/, "Stable workspace state for entity writes");
has(app, /normaliseSettingsSnapshot[\s\S]*workspace: normaliseWorkspaceData\(raw\.workspace\)/, "Cloud workspace snapshot normalization");

// Database and security foundation.
for (const table of ["workshops", "workshop_members", "workshop_snapshots", "workshop_customers", "workshop_devices", "workshop_repairs", "workshop_parts", "workshop_inventory", "workshop_suppliers", "workshop_purchase_orders", "workshop_appointments", "workshop_payments", "workshop_estimates", "workshop_attachments", "workshop_activity", "sync_health_events"]) {
  has(schema, new RegExp(`create table if not exists public\\.${table}`, "i"), `${table} table`);
  has(schema, new RegExp(`alter table public\\.${table} enable row level security`, "i"), `${table} RLS`);
}
has(schema, /role text[\s\S]*owner[\s\S]*manager[\s\S]*technician[\s\S]*viewer/i, "Workshop role model");
has(schema, /save_workshop_data[\s\S]*Workshop write access required[\s\S]*temporarily read-only/i, "Server-enforced write restrictions");
has(schema, /private\.admin_audit_log[\s\S]*enable row level security/i, "Private owner audit log");
has(schema, /storage\.buckets[\s\S]*repair-attachments[\s\S]*private\.is_workshop_member/i, "Private attachment storage");
has(schema, /digest\([^)]*sha256|digest\([^)]*'sha256'/i, "Hashed portal tokens");
has(cloud, /APP_VERSION = "0\.3\.4"[\s\S]*p_app_version: APP_VERSION/i, "Versioned cloud writes");
has(app, /\^custom-\[a-z0-9-\]/, "Custom status normalization");

assert.equal(manifest.start_url, "./");
assert.equal(manifest.display, "standalone");
assert.ok(manifest.shortcuts.length >= 2, "PWA shortcuts are required");
has(serviceWorker, /repairdesk-v0\.3\.4[\s\S]*cache\.addAll[\s\S]*clients\.claim/i, "Offline application shell");
has(html, /class="version-badge">0\.3\.4</, "Visible release version");
has(html, /src="app\.js\?v=0\.3\.4-r1"/, "Browser-cache-safe application entry");
has(serviceWorker, /app\.js\?v=0\.3\.4-r1/, "Offline cache for the revisioned application entry");

console.log("RepairDesk v0.3.4 release contract passed: all approved P0/P1 blocks are represented and guarded.");
