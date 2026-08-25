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

const calls = { inserts: [], updates: [], rpc: [], signUp: null, reset: null };
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
    if (name === "get_admin_dashboard") return { data: { totals: { total_users: 1 }, daily: [], feedback: [] }, error: null };
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
assert.equal(calls.rpc[0].name, "save_user_data");
assert.equal(calls.rpc[0].payload.p_expected_revision, 4);

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

await api.submitFeedback("idea", "Add barcode scanning", "settings");
const feedback = calls.rpc.find((entry) => entry.name === "submit_user_feedback");
assert.equal(feedback.payload.p_type, "idea");
assert.equal(feedback.payload.p_message, "Add barcode scanning");

assert.equal((await api.loadAdminDashboard()).totals.total_users, 1);
await api.updateFeedbackStatus(1, "planned");
const feedbackUpdate = calls.updates.find((entry) => entry.table === "feedback");
assert.equal(feedbackUpdate.table, "feedback");
assert.equal(feedbackUpdate.payload.status, "planned");

await api.sendPasswordReset("owner@example.com");
assert.equal(calls.reset.options.redirectTo, "https://pikaneth.github.io/RepairDesk/?recovery=1");

const schema = read("supabase/schema.sql");
for (const table of ["profiles", "app_data", "feedback", "analytics_events"]) {
  assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`, "i"), `${table} must enable RLS`);
}
assert.match(schema, /create or replace function public\.save_user_data[\s\S]*security definer/i);
assert.match(schema, /create or replace function public\.get_admin_dashboard[\s\S]*Administrator access required/i);
assert.match(schema, /create or replace function public\.track_product_event[\s\S]*Analytics rate limit exceeded/i);
assert.match(schema, /create or replace function public\.submit_user_feedback[\s\S]*Feedback rate limit exceeded/i);
assert.match(schema, /grant select on public\.app_data to authenticated/i);
assert.doesNotMatch(schema, /grant insert \([^)]*\) on public\.profiles to authenticated/i, "Profiles must be created only by the trusted auth trigger");
assert.match(schema, /revoke insert \([^)]*\) on public\.profiles from authenticated/i, "Schema upgrades must remove the earlier browser profile-insert grant");
assert.match(schema, /grant update \(status\) on public\.feedback to authenticated/i, "Product administrators may update only feedback status");
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
