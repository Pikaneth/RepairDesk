(() => {
  const DEVICE_KEY = "repairdesk.cloud.device.v1";
  const SESSION_KEY = "repairdesk.cloud.session.v1";
  const config = window.REPAIRDESK_CONFIG || {};
  const state = {
    client: null,
    session: null,
    user: null,
    ready: false,
    configured: false,
    authSubscription: null,
  };

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  }

  function randomId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function stableId(key) {
    const stored = storageGet(key);
    if (stored) return stored;
    const value = randomId();
    storageSet(key, value);
    return value;
  }

  const deviceId = stableId(DEVICE_KEY);
  let sessionId = randomId();
  storageSet(SESSION_KEY, sessionId);

  function privilegedKey(key) {
    if (/^sb_secret_/i.test(key)) return true;
    const parts = key.split(".");
    if (parts.length !== 3 || typeof globalThis.atob !== "function") return false;
    try {
      const encoded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(globalThis.atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
      return payload?.role === "service_role";
    } catch { return false; }
  }

  function validConfiguration() {
    const url = String(config.supabaseUrl || "").trim();
    const key = String(config.supabasePublishableKey || "").trim();
    return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) && key.length >= 30 && !privilegedKey(key);
  }

  function cleanError(error, fallback = "Cloud request failed.") {
    const message = String(error?.message || fallback).replace(/\s+/g, " ").trim();
    return new Error(message.slice(0, 300));
  }

  function cleanProperties(properties) {
    if (!properties || typeof properties !== "object" || Array.isArray(properties)) return {};
    return Object.fromEntries(Object.entries(properties).slice(0, 20).map(([key, value]) => {
      const safeKey = String(key).replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 50);
      const safeValue = ["string", "number", "boolean"].includes(typeof value) ? value : String(value ?? "");
      return [safeKey, typeof safeValue === "string" ? safeValue.slice(0, 200) : safeValue];
    }).filter(([key]) => key));
  }

  async function init(onAuthChange) {
    if (state.ready) return { configured: state.configured, session: state.session, user: state.user };
    state.configured = validConfiguration() && Boolean(window.supabase?.createClient);
    state.ready = true;
    if (!state.configured) return { configured: false, session: null, user: null };

    state.client = window.supabase.createClient(
      String(config.supabaseUrl).replace(/\/$/, ""),
      String(config.supabasePublishableKey),
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "repairdesk.auth.v1",
        },
      },
    );

    const { data, error } = await state.client.auth.getSession();
    if (error) throw cleanError(error, "Could not restore the session.");
    state.session = data.session;
    state.user = data.session?.user || null;

    const { data: listener } = state.client.auth.onAuthStateChange((event, session) => {
      state.session = session;
      state.user = session?.user || null;
      if (event === "SIGNED_IN") {
        sessionId = randomId();
        storageSet(SESSION_KEY, sessionId);
      }
      if (typeof onAuthChange === "function") queueMicrotask(() => onAuthChange(event, session));
    });
    state.authSubscription = listener.subscription;
    return { configured: true, session: state.session, user: state.user };
  }

  async function signUp({ email, password, workshopName, language, country, currency }) {
    if (!state.client) throw new Error("Cloud service is not configured.");
    const redirectTo = String(config.siteUrl || window.location.href).split("#")[0].split("?")[0];
    const { data, error } = await state.client.auth.signUp({
      email: String(email).trim(),
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          workshop_name: String(workshopName || "").trim().slice(0, 100),
          language: String(language || "en").slice(0, 10),
          country: String(country || "US").slice(0, 2),
          currency: String(currency || "USD").slice(0, 3),
        },
      },
    });
    if (error) throw cleanError(error, "Registration failed.");
    if (data.session) {
      state.session = data.session;
      state.user = data.user;
    }
    return data;
  }

  async function signIn(email, password) {
    if (!state.client) throw new Error("Cloud service is not configured.");
    const { data, error } = await state.client.auth.signInWithPassword({ email: String(email).trim(), password });
    if (error) throw cleanError(error, "Sign in failed.");
    state.session = data.session;
    state.user = data.user;
    return data;
  }

  async function sendPasswordReset(email) {
    if (!state.client) throw new Error("Cloud service is not configured.");
    const redirectTo = `${String(config.siteUrl || window.location.href).split("#")[0].split("?")[0]}?recovery=1`;
    const { error } = await state.client.auth.resetPasswordForEmail(String(email).trim(), { redirectTo });
    if (error) throw cleanError(error, "Password reset request failed.");
  }

  async function updatePassword(password) {
    if (!state.client) throw new Error("Cloud service is not configured.");
    const { data, error } = await state.client.auth.updateUser({ password });
    if (error) throw cleanError(error, "Password update failed.");
    return data;
  }

  async function signOut() {
    if (!state.client) return;
    const { error } = await state.client.auth.signOut();
    if (error) throw cleanError(error, "Sign out failed.");
  }

  async function loadSnapshot() {
    if (!state.client || !state.user) return null;
    const { data, error } = await state.client
      .from("app_data")
      .select("repairs, settings, deleted_repairs, revision, updated_at, last_device_id")
      .eq("user_id", state.user.id)
      .maybeSingle();
    if (error) throw cleanError(error, "Could not download workshop data.");
    return data;
  }

  async function loadProfile() {
    if (!state.client || !state.user) return null;
    const { data, error } = await state.client
      .from("profiles")
      .select("workshop_name, language, country, currency, onboarding_completed, is_admin, created_at, last_seen_at")
      .eq("id", state.user.id)
      .maybeSingle();
    if (error) throw cleanError(error, "Could not load the account profile.");
    return data;
  }

  async function saveSnapshot({ repairs, settings, deletedRepairs, expectedRevision }) {
    if (!state.client || !state.user) return { ok: false, offline: true };
    const body = JSON.stringify({ repairs, settings, deletedRepairs });
    if (body.length > 4_500_000) throw new Error("Workshop data is too large to synchronise.");
    const { data, error } = await state.client.rpc("save_user_data", {
      p_repairs: repairs,
      p_settings: settings,
      p_deleted_repairs: deletedRepairs,
      p_expected_revision: Number.isFinite(expectedRevision) ? expectedRevision : null,
      p_device_id: deviceId,
    });
    if (error) throw cleanError(error, "Could not synchronise workshop data.");
    return data;
  }

  async function updateProfile(values) {
    if (!state.client || !state.user) return;
    const payload = {
      id: state.user.id,
      workshop_name: String(values.workshopName || "").trim().slice(0, 100),
      language: String(values.language || "en").slice(0, 10),
      country: String(values.country || "US").slice(0, 2),
      currency: String(values.currency || "USD").slice(0, 3),
      onboarding_completed: Boolean(values.onboardingCompleted),
      last_seen_at: new Date().toISOString(),
    };
    const { error } = await state.client.from("profiles").upsert(payload, { onConflict: "id" });
    if (error) throw cleanError(error, "Could not update the account profile.");
  }

  async function submitFeedback(type, message, page) {
    if (!state.client || !state.user) throw new Error("Sign in before sending feedback.");
    const { error } = await state.client.rpc("submit_user_feedback", {
      p_type: String(type || "other").slice(0, 30),
      p_message: String(message || "").trim().slice(0, 3000),
      p_page: String(page || "overview").slice(0, 60),
      p_app_version: "0.2.0",
    });
    if (error) throw cleanError(error, "Could not send feedback.");
    await track("feedback_sent", { type });
  }

  async function loadAdminDashboard() {
    if (!state.client || !state.user) throw new Error("Authentication required.");
    const { data, error } = await state.client.rpc("get_admin_dashboard");
    if (error) throw cleanError(error, "Could not load analytics.");
    return data;
  }

  async function updateFeedbackStatus(id, status) {
    if (!state.client || !state.user) throw new Error("Authentication required.");
    const allowed = new Set(["new", "reviewing", "planned", "resolved", "closed"]);
    if (!allowed.has(status)) throw new Error("Invalid feedback status.");
    const { error } = await state.client.from("feedback").update({ status }).eq("id", Number(id));
    if (error) throw cleanError(error, "Could not update feedback.");
  }

  async function track(name, properties = {}) {
    if (!config.analyticsEnabled || !state.client || !state.user) return;
    const eventName = String(name || "").replace(/[^a-z0-9_.-]/gi, "").slice(0, 60);
    if (!eventName) return;
    try {
      await state.client.rpc("track_product_event", {
        p_session_id: sessionId,
        p_device_id: deviceId,
        p_event_name: eventName,
        p_properties: cleanProperties(properties),
        p_app_version: "0.2.0",
      });
    } catch {}
  }

  window.RepairDeskCloud = Object.freeze({
    init,
    signUp,
    signIn,
    signOut,
    sendPasswordReset,
    updatePassword,
    loadSnapshot,
    loadProfile,
    saveSnapshot,
    updateProfile,
    submitFeedback,
    loadAdminDashboard,
    updateFeedbackStatus,
    track,
    isConfigured: () => state.configured,
    currentUser: () => state.user,
    currentSession: () => state.session,
    deviceId: () => deviceId,
  });
})();
