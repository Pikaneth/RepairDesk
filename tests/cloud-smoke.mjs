import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), "utf8");

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    values,
  };
}

function createContext(config, supabase) {
  const localStorage = storage();
  let uuid = 0;
  const window = {
    REPAIRDESK_CONFIG: config,
    supabase,
    location: { href: "https://pikaneth.github.io/RepairDesk/" },
  };
  const context = {
    window,
    localStorage,
    crypto: { randomUUID: () => `cloud-test-${++uuid}` },
    Date,
    Math,
    JSON,
    Object,
    String,
    Number,
    Boolean,
    Array,
    RegExp,
    Error,
    Blob,
    queueMicrotask: (callback) => callback(),
  };
  window.window = window;
  vm.createContext(context);
  vm.runInContext(read("cloud.js"), context);
  return { api: window.RepairDeskCloud, localStorage };
}

{
  const { api } = createContext({ supabaseUrl: "", supabasePublishableKey: "" });
  const result = await api.init(() => {});
  assert.equal(result.configured, false, "Empty cloud configuration must keep local mode available");
  assert.equal(api.currentUser(), null);
}

{
  const { api } = createContext({
    supabaseUrl: "https://repairdesk-test.supabase.co",
    supabasePublishableKey: "sb_secret_this_key_must_never_run_in_a_browser",
  }, { createClient: () => { throw new Error("A privileged key must be rejected before client creation"); } });
  assert.equal((await api.init(() => {})).configured, false, "Privileged browser credentials must be rejected");
}

const calls = { inserts: [], updates: [], rpc: [], storage: [], mfa: [], signUp: null, reset: null };
const user = { id: "00000000-0000-4000-8000-000000000001", email: "owner@example.com" };
const snapshot = { repairs: [], settings: {}, deleted_repairs: [], revision: 4, updated_at: "2026-08-18T12:00:00.000Z", last_device_id: "other-device" };

const client = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signUp: async (payload) => {
      calls.signUp = payload;
      return { data: { user, session: null }, error: null };
    },
    signInWithPassword: async () => ({ data: { user, session: { user, access_token: "test-token" } }, error: null }),
    resetPasswordForEmail: async (email, options) => {
      calls.reset = { email, options };
      return { error: null };
    },
    updateUser: async () => ({ data: { user }, error: null }),
    signOut: async () => ({ error: null }),
    mfa: {
      listFactors: async () => {
        calls.mfa.push({ action: "list" });
        return { data: { totp: [{ id: "factor-1", status: "verified" }] }, error: null };
      },
      enroll: async (payload) => {
        calls.mfa.push({ action: "enroll", payload });
        return { data: { id: "factor-2", totp: { qr_code: "data:image/svg+xml,test" } }, error: null };
      },
      challenge: async (payload) => {
        calls.mfa.push({ action: "challenge", payload });
        return { data: { id: "challenge-1" }, error: null };
      },
      verify: async (payload) => {
        calls.mfa.push({ action: "verify", payload });
        return { data: { access_token: "mfa-token" }, error: null };
      },
      unenroll: async (payload) => {
        calls.mfa.push({ action: "unenroll", payload });
        return { data: { id: payload.factorId }, error: null };
      },
    },
  },
  storage: {
    from(bucket) {
      assert.equal(bucket, "repair-attachments");
      return {
        async upload(path, file, options) {
          calls.storage.push({ action: "upload", path, file, options });
          return { data: { path }, error: null };
        },
        async createSignedUrl(path, expiresIn) {
          calls.storage.push({ action: "signed-url", path, expiresIn });
          return { data: { signedUrl: `https://files.example/${path}` }, error: null };
        },
        async remove(paths) {
          calls.storage.push({ action: "remove", paths });
          return { data: paths, error: null };
        },
      };
    },
  },
  from(table) {
    const builder = {
      select() { return builder; },
      eq() { return builder; },
      async maybeSingle() {
        if (table === "app_data") return { data: snapshot, error: null };
        if (table === "profiles") return { data: { workshop_name: "Test Lab", is_admin: true }, error: null };
        return { data: null, error: null };
      },
      async insert(payload) {
        calls.inserts.push({ table, payload });
        return { data: null, error: null };
      },
      update(payload) {
        calls.updates.push({ table, payload });
        return builder;
      },
    };
    return builder;
  },
  async rpc(name, payload) {
    calls.rpc.push({ name, payload });
    if (name === "get_workshop_snapshot") return { data: snapshot, error: null };
    if (name === "save_workshop_data") return { data: { ok: true, revision: 5, updated_at: "2026-08-18T12:01:00.000Z" }, error: null };
    if (name === "get_admin_dashboard_v034") return { data: { totals: { total_users: 1 }, daily: [], feedback: [], system: {} }, error: null };
    if (name === "get_admin_users_v034") return { data: { total: 1, users: [{ id: user.id, email: user.email, repair_count: 0 }] }, error: null };
    if (name === "get_admin_dashboard") return { data: { totals: { total_users: 1 }, daily: [], feedback: [] }, error: null };
    if (name === "get_admin_users") return { data: { total: 1, users: [{ id: user.id, email: user.email, repair_count: 0 }] }, error: null };
    if (name === "set_admin_feedback_status") return { data: { ok: true, id: payload.p_id, status: payload.p_status }, error: null };
    return { data: { ok: true, revision: 5, updated_at: "2026-08-18T12:01:00.000Z" }, error: null };
  },
};

const supabase = {
  createClient(url, key, options) {
    assert.equal(url, "https://repairdesk-test.supabase.co");
    assert.ok(key.startsWith("sb_publishable_"));
    assert.equal(options.auth.persistSession, true);
    return client;
  },
};

const { api } = createContext({
  supabaseUrl: "https://repairdesk-test.supabase.co",
  supabasePublishableKey: "sb_publishable_repairdesk_test_key_1234567890",
  siteUrl: "https://pikaneth.github.io/RepairDesk/",
  analyticsEnabled: true,
}, supabase);

const initial = await api.init(() => {});
assert.equal(initial.configured, true);
await api.track("anonymous_event");
assert.equal(calls.rpc.length, 0, "Anonymous analytics must not be written directly to the database");

await api.signUp({ email: "owner@example.com", password: "long-password", workshopName: "Test Lab", language: "en", country: "DE", currency: "EUR" });
assert.equal(calls.signUp.options.data.workshop_name, "Test Lab");
assert.equal(calls.signUp.options.emailRedirectTo, "https://pikaneth.github.io/RepairDesk/");

await api.signIn("owner@example.com", "long-password");
assert.equal(api.currentUser().id, user.id, "Sign-in must update cloud state before the workspace is loaded");
assert.equal((await api.loadSnapshot()).revision, 4);
assert.equal((await api.loadProfile()).is_admin, true);

const saved = await api.saveSnapshot({ repairs: [], settings: {}, deletedRepairs: [], expectedRevision: 4 });
assert.equal(saved.revision, 5);
const sharedSave = calls.rpc.find((entry) => entry.name === "save_workshop_data");
assert.ok(sharedSave, "Shared workshop snapshots must use the v0.3.4 RPC");
assert.equal(sharedSave.payload.p_expected_revision, 4);
assert.equal(sharedSave.payload.p_app_version, "0.3.4");

await api.updateProfile({ workshopName: "Test Lab", language: "en", country: "DE", currency: "EUR", onboardingCompleted: true });
const profileUpdate = calls.updates.find((entry) => entry.table === "profiles");
assert.ok(profileUpdate, "Profile settings must use an update against the trigger-created row");
assert.equal("id" in profileUpdate.payload, false, "The immutable profile id must not be included in an update payload");

await api.track("repair_created", { category: "smartphone", "bad key": "removed", nested: { unsafe: true } });
const analytics = calls.rpc.find((entry) => entry.name === "track_product_event");
assert.equal(analytics.payload.p_event_name, "repair_created");
assert.equal(analytics.payload.p_properties.category, "smartphone");
assert.equal(analytics.payload.p_properties.badkey, "removed");
assert.equal(typeof analytics.payload.p_properties.nested, "string");
assert.equal(analytics.payload.p_app_version, "0.3.4");

await api.submitFeedback("idea", "Add barcode scanning", "settings");
const feedback = calls.rpc.find((entry) => entry.name === "submit_user_feedback");
assert.equal(feedback.payload.p_type, "idea");
assert.equal(feedback.payload.p_message, "Add barcode scanning");
assert.equal(feedback.payload.p_app_version, "0.3.4");

assert.equal((await api.loadAdminDashboard()).totals.total_users, 1);
const directory = await api.loadAdminUsers("owner", 25, 0);
assert.equal(directory.users[0].email, user.email);
const userDirectoryCall = calls.rpc.find((entry) => entry.name === "get_admin_users_v034");
assert.equal(userDirectoryCall.payload.p_query, "owner");
assert.equal(userDirectoryCall.payload.p_limit, 25);
await api.updateFeedbackStatus(1, "planned");
const feedbackUpdate = calls.rpc.find((entry) => entry.name === "set_admin_feedback_status");
assert.equal(feedbackUpdate.payload.p_id, 1);
assert.equal(feedbackUpdate.payload.p_status, "planned");
assert.equal(calls.updates.some((entry) => entry.table === "feedback"), false, "Feedback changes must use the audited administrator RPC");

await api.setFeatureFlag("minimum_app_version", true, 100, "Require the current client", "0.3.4");
const featureFlag = calls.rpc.find((entry) => entry.name === "admin_set_feature_flag");
assert.deepEqual(JSON.parse(JSON.stringify(featureFlag.payload)), {
  p_key: "minimum_app_version",
  p_enabled: true,
  p_rollout: 100,
  p_description: "Require the current client",
  p_value: "0.3.4",
});

assert.equal((await api.listMfaFactors()).totp[0].status, "verified");
assert.equal((await api.enrollMfa()).id, "factor-2");
await api.verifyMfa("factor-2", "123456");
await api.unenrollMfa("factor-2");
assert.deepEqual(calls.mfa.map((entry) => entry.action), ["list", "enroll", "challenge", "verify", "unenroll"]);
assert.deepEqual(JSON.parse(JSON.stringify(calls.mfa.find((entry) => entry.action === "verify").payload)), {
  factorId: "factor-2",
  challengeId: "challenge-1",
  code: "123456",
});

const attachment = new Blob(["repair-photo"], { type: "image/png" });
Object.defineProperty(attachment, "name", { value: "before photo.png" });
const uploaded = await api.uploadAttachment("11111111-1111-4111-8111-111111111111", "repair-42", attachment);
assert.match(uploaded.path, /^11111111-1111-4111-8111-111111111111\/repair-42\/cloud-test-\d+-before-photo\.png$/);
assert.equal(await api.attachmentUrl(uploaded.path, 900), `https://files.example/${uploaded.path}`);
await api.deleteAttachment(uploaded.path);
assert.deepEqual(calls.storage.map((entry) => entry.action), ["upload", "signed-url", "remove"]);

await api.sendPasswordReset("owner@example.com");
assert.equal(calls.reset.options.redirectTo, "https://pikaneth.github.io/RepairDesk/?recovery=1");

const schema = read("supabase/schema.sql");
for (const table of ["profiles", "app_data", "feedback", "analytics_events"]) {
  assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`, "i"), `${table} must enable RLS`);
}
for (const table of ["workshops", "workshop_members", "workshop_snapshots", "workshop_customers", "workshop_devices", "workshop_repairs", "workshop_inventory", "workshop_suppliers", "workshop_purchase_orders", "workshop_appointments", "workshop_payments", "workshop_estimates", "workshop_attachments", "sync_health_events", "app_feature_flags", "app_announcements", "app_releases"]) {
  assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`, "i"), `${table} must enable RLS`);
}
for (const functionName of ["get_my_workshop", "get_workshop_snapshot", "save_workshop_data", "get_public_repair_status", "get_admin_dashboard_v034", "get_admin_users_v034", "get_admin_user_detail", "admin_update_user_status", "admin_export_user_data", "admin_update_feedback", "admin_set_feature_flag", "admin_publish_announcement"]) {
  assert.match(schema, new RegExp(`create or replace function public\\.${functionName}`, "i"), `${functionName} is required in v0.3.4`);
  assert.match(schema, new RegExp(`create or replace function public\\.${functionName}[\\s\\S]*?security definer[\\s\\S]*?set search_path\\s*=\\s*''`, "i"), `${functionName} must pin an empty search path`);
}
assert.match(schema, /create table if not exists public\.app_feature_flags[\s\S]*?value text not null default ''/i, "Feature flags must carry values for minimum-version controls");
assert.match(schema, /'minimum_app_version', false, '0\.3\.4'/i, "The current minimum client version must be seeded without blocking existing users");
assert.match(schema, /create or replace function public\.save_workshop_data[\s\S]*?v_role = 'viewer'[\s\S]*?maintenance_mode[\s\S]*?minimum_app_version/i, "Server-side workspace writes must enforce roles and runtime restrictions");
assert.match(schema, /'churned_period'[\s\S]*?'product_usage'[\s\S]*?'security'/i, "The owner dashboard must expose churn, product usage, and security health");
assert.match(schema, /insert into storage\.buckets[\s\S]*?'repair-attachments'[\s\S]*?false[\s\S]*?5242880/i, "Repair attachments must use a private size-limited Storage bucket");
for (const policy of ["repair_attachments_member_select", "repair_attachments_member_insert", "repair_attachments_member_update", "repair_attachments_member_delete"]) {
  assert.match(schema, new RegExp(`create policy "${policy}" on storage\\.objects`, "i"), `${policy} is required`);
}
assert.match(schema, /create or replace function public\.save_user_data[\s\S]*security definer/i);
assert.match(schema, /create or replace function public\.get_admin_dashboard[\s\S]*Administrator access required/i);
assert.match(schema, /create or replace function public\.get_admin_users[\s\S]*Administrator access required/i);
assert.match(schema, /create or replace function public\.set_admin_feedback_status[\s\S]*Administrator access required/i);
for (const functionName of ["get_admin_dashboard", "get_admin_users", "set_admin_feedback_status"]) {
  assert.match(schema, new RegExp(`create or replace function public\\.${functionName}[\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`, "i"), `${functionName} must pin an empty search path`);
}
assert.match(schema, /create or replace function public\.track_product_event[\s\S]*Analytics rate limit exceeded/i);
assert.match(schema, /create or replace function public\.submit_user_feedback[\s\S]*Feedback rate limit exceeded/i);
assert.match(schema, /create table if not exists private\.admin_audit_log/i, "Owner actions must have a private audit log");
assert.match(schema, /alter table private\.admin_audit_log enable row level security/i, "The owner audit log must use defense-in-depth RLS");
assert.match(schema, /jsonb_array_length\(d\.repairs\)[\s\S]*snapshot_bytes/i, "The owner directory may expose only aggregate workspace health");
assert.doesNotMatch(schema, /'repairs'\s*,\s*user_row\.repairs/i, "The owner directory must never return customer repair snapshots");
assert.match(schema, /grant select on public\.app_data to authenticated/i);
assert.doesNotMatch(schema, /grant insert \([^)]*\) on public\.profiles to authenticated/i, "Profiles must be created only by the trusted auth trigger");
assert.match(schema, /revoke insert \([^)]*\) on public\.profiles from authenticated/i, "Schema upgrades must remove the earlier browser profile-insert grant");
assert.match(schema, /revoke update \(status\) on public\.feedback from authenticated/i, "Feedback changes must be restricted to the audited RPC");
assert.doesNotMatch(schema, /grant update \(status\) on public\.feedback to authenticated/i, "Direct feedback updates must not remain exposed");
assert.doesNotMatch(schema, /grant select, update on public\.feedback/i, "Feedback messages and ownership must remain immutable from the browser");
assert.doesNotMatch(schema, /grant usage, select on all sequences/i, "Browser users do not need blanket sequence privileges");
assert.match(schema, /revoke usage, select on all sequences in schema public from authenticated/i, "Schema upgrades must remove earlier blanket sequence privileges");
const appDataSelectPolicy = schema.match(/create policy "app_data_select_own"[\s\S]*?;/i)?.[0] || "";
assert.match(appDataSelectPolicy, /using \(user_id = \(select auth\.uid\(\)\)\);/i, "Administrators must not receive blanket access to customer repair snapshots");
assert.doesNotMatch(appDataSelectPolicy, /is_app_admin/i, "Workshop snapshots must remain isolated even from product administrators");
assert.doesNotMatch(schema, /grant select, insert, update on public\.app_data/i, "Snapshots must only be written through the guarded RPC");
assert.doesNotMatch(schema, /grant select, insert on public\.analytics_events/i, "Analytics must only be written through the rate-limited RPC");
assert.doesNotMatch(schema, /service_role|secret_key/i, "Schema must not contain privileged credentials");

console.log("RepairDesk cloud checks passed: configuration fallback, auth, sync RPC, analytics, feedback and RLS.");
