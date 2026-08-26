(() => {
  const DEVICE_KEY = "repairdesk.cloud.device.v1";
  const SESSION_KEY = "repairdesk.cloud.session.v1";
  const APP_VERSION = "0.3.4";
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

  async function rpc(name, params = {}, fallback = "Cloud request failed.") {
    if (!state.client) throw new Error("Cloud service is not configured.");
    const { data, error } = await state.client.rpc(name, params);
    if (error) throw cleanError(error, fallback);
    return data;
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
    const { data: sharedData, error: sharedError } = await state.client.rpc("get_workshop_snapshot");
    if (!sharedError) return sharedData;
    if (!/function|schema cache|does not exist/i.test(String(sharedError.message || ""))) {
      throw cleanError(sharedError, "Could not download workshop data.");
    }
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
      .select("workshop_name, language, country, currency, onboarding_completed, is_admin, account_status, active_workshop_id, created_at, last_seen_at")
      .eq("id", state.user.id)
      .maybeSingle();
    if (error) throw cleanError(error, "Could not load the account profile.");
    return data;
  }

  async function saveSnapshot({ repairs, settings, deletedRepairs, expectedRevision }) {
    if (!state.client || !state.user) return { ok: false, offline: true };
    const body = JSON.stringify({ repairs, settings, deletedRepairs });
    if (body.length > 8_000_000) throw new Error("Workshop data is too large to synchronise.");
    const shared = await state.client.rpc("save_workshop_data", {
      p_repairs: repairs,
      p_settings: settings,
      p_deleted_repairs: deletedRepairs,
      p_expected_revision: Number.isFinite(expectedRevision) ? expectedRevision : null,
      p_device_id: deviceId,
      p_app_version: APP_VERSION,
    });
    if (!shared.error) return shared.data;
    if (!/function|schema cache|does not exist/i.test(String(shared.error.message || ""))) {
      throw cleanError(shared.error, "Could not synchronise workshop data.");
    }
    const legacy = await state.client.rpc("save_user_data", {
      p_repairs: repairs,
      p_settings: settings,
      p_deleted_repairs: deletedRepairs,
      p_expected_revision: Number.isFinite(expectedRevision) ? expectedRevision : null,
      p_device_id: deviceId,
    });
    if (legacy.error) throw cleanError(legacy.error, "Could not synchronise workshop data.");
    return legacy.data;
  }

  async function loadWorkshop() {
    if (!state.user) return null;
    return rpc("get_my_workshop", {}, "Could not load workshop access.");
  }

  async function createWorkshopInvite(email, role = "technician") {
    return rpc("create_workshop_invite", {
      p_email: String(email || "").trim().slice(0, 160),
      p_role: String(role || "technician").slice(0, 30),
    }, "Could not create the invitation.");
  }

  async function acceptWorkshopInvite(token) {
    return rpc("accept_workshop_invite", { p_token: String(token || "").trim().slice(0, 300) }, "Could not accept the invitation.");
  }

  async function updateWorkshopMember(userId, role, status) {
    return rpc("update_workshop_member", {
      p_user_id: String(userId || ""), p_role: String(role || "technician"), p_status: String(status || "active"),
    }, "Could not update the team member.");
  }

  async function loadRuntimeConfig() {
    return rpc("get_runtime_config", {}, "Could not load application controls.");
  }

  async function loadPublicRepair(token) {
    return rpc("get_public_repair_status", { p_token: String(token || "").trim().slice(0, 300) }, "Could not open the repair portal.");
  }

  async function respondToEstimate(token, response) {
    return rpc("respond_to_public_estimate", {
      p_token: String(token || "").trim().slice(0, 300), p_response: String(response || "").slice(0, 30),
    }, "Could not save the estimate response.");
  }

  async function loadPortalUpdates(repairId) {
    return rpc("get_portal_updates", { p_repair_id: String(repairId || "").slice(0, 120) }, "Could not load customer responses.");
  }

  function safeStoragePath(workshopId, repairId, fileName) {
    const name = String(fileName || "attachment").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-140);
    return `${String(workshopId).replace(/[^a-f0-9-]/gi, "")}/${String(repairId).replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120)}/${randomId()}-${name}`;
  }

  async function uploadAttachment(workshopId, repairId, file) {
    if (!state.client || !state.user || !(file instanceof Blob)) throw new Error("A signed-in account and file are required.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Attachments are limited to 5 MB.");
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
    if (!allowed.has(file.type)) throw new Error("Use a JPEG, PNG, WebP or PDF file.");
    const path = safeStoragePath(workshopId, repairId, file.name);
    const { error } = await state.client.storage.from("repair-attachments").upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw cleanError(error, "Could not upload the attachment.");
    return { path, fileName: String(file.name || "attachment").slice(0, 220), mimeType: file.type, size: file.size };
  }

  async function attachmentUrl(path, expiresIn = 900) {
    if (!state.client) throw new Error("Cloud service is not configured.");
    const { data, error } = await state.client.storage.from("repair-attachments").createSignedUrl(String(path || ""), Math.min(3600, Math.max(60, Number(expiresIn) || 900)));
    if (error) throw cleanError(error, "Could not open the attachment.");
    return data?.signedUrl || "";
  }

  async function deleteAttachment(path) {
    if (!state.client) return;
    const { error } = await state.client.storage.from("repair-attachments").remove([String(path || "")]);
    if (error) throw cleanError(error, "Could not delete the attachment.");
  }

  async function updateProfile(values) {
    if (!state.client || !state.user) return;
    const payload = {
      workshop_name: String(values.workshopName || "").trim().slice(0, 100),
      language: String(values.language || "en").slice(0, 10),
      country: String(values.country || "US").slice(0, 2),
      currency: String(values.currency || "USD").slice(0, 3),
      onboarding_completed: Boolean(values.onboardingCompleted),
      last_seen_at: new Date().toISOString(),
    };
    const { error } = await state.client.from("profiles").update(payload).eq("id", state.user.id);
    if (error) throw cleanError(error, "Could not update the account profile.");
  }

  async function submitFeedback(type, message, page) {
    if (!state.client || !state.user) throw new Error("Sign in before sending feedback.");
    const { error } = await state.client.rpc("submit_user_feedback", {
      p_type: String(type || "other").slice(0, 30),
      p_message: String(message || "").trim().slice(0, 3000),
      p_page: String(page || "overview").slice(0, 60),
      p_app_version: APP_VERSION,
    });
    if (error) throw cleanError(error, "Could not send feedback.");
    await track("feedback_sent", { type });
  }

  async function loadAdminDashboard(from = "", to = "") {
    if (!state.client || !state.user) throw new Error("Authentication required.");
    const advanced = await state.client.rpc("get_admin_dashboard_v034", { p_from: from || null, p_to: to || null });
    if (!advanced.error) return advanced.data;
    if (!/function|schema cache|does not exist/i.test(String(advanced.error.message || ""))) throw cleanError(advanced.error, "Could not load analytics.");
    return rpc("get_admin_dashboard", {}, "Could not load analytics.");
  }

  async function loadAdminUsers(query = "", limit = 50, offset = 0, filter = "all") {
    if (!state.client || !state.user) throw new Error("Authentication required.");
    const params = {
      p_query: String(query || "").trim().slice(0, 120),
      p_limit: Math.min(100, Math.max(1, Number(limit) || 50)),
      p_offset: Math.min(10000, Math.max(0, Number(offset) || 0)),
      p_filter: String(filter || "all").slice(0, 30),
    };
    const advanced = await state.client.rpc("get_admin_users_v034", params);
    if (!advanced.error) return advanced.data;
    if (!/function|schema cache|does not exist/i.test(String(advanced.error.message || ""))) throw cleanError(advanced.error, "Could not load user directory.");
    delete params.p_filter;
    return rpc("get_admin_users", params, "Could not load user directory.");
  }

  async function loadAdminUserDetail(userId) { return rpc("get_admin_user_detail", { p_user_id: userId }, "Could not load the user profile."); }
  async function loadAdminWorkshops(query = "", limit = 100, offset = 0) {
    return rpc("get_admin_workspaces", { p_query: String(query || "").slice(0, 120), p_limit: limit, p_offset: offset }, "Could not load workshops.");
  }
  async function setAdminUserStatus(userId, status) { return rpc("admin_update_user_status", { p_user_id: userId, p_status: status }, "Could not update the account."); }
  async function deleteAdminUser(userId, email) { return rpc("admin_delete_user", { p_user_id: userId, p_email_confirmation: email }, "Could not delete the account."); }
  async function exportAdminUser(userId) { return rpc("admin_export_user_data", { p_user_id: userId }, "Could not export account data."); }
  async function addAdminSupportNote(userId, note) { return rpc("admin_add_support_note", { p_user_id: userId, p_note: String(note || "").slice(0, 2000) }, "Could not save the support note."); }
  async function updateAdminFeedback(id, values) {
    return rpc("admin_update_feedback", {
      p_id: Number(id), p_status: values.status, p_priority: values.priority, p_category: values.category,
      p_admin_note: values.adminNote || "", p_release_version: values.releaseVersion || "",
    }, "Could not update feedback.");
  }
  async function setFeatureFlag(key, enabled, rollout, description = "", value = "") {
    return rpc("admin_set_feature_flag", { p_key: key, p_enabled: Boolean(enabled), p_rollout: Number(rollout), p_description: description, p_value: String(value || "").slice(0, 120) }, "Could not update the feature flag.");
  }
  async function publishAnnouncement(values) {
    return rpc("admin_publish_announcement", {
      p_title: values.title, p_message: values.message, p_kind: values.kind, p_audience: values.audience, p_ends_at: values.endsAt || null,
    }, "Could not publish the announcement.");
  }
  async function recordAdminAction(action, targetType = "system", targetId = "", details = {}) {
    return rpc("admin_record_action", { p_action: action, p_target_type: targetType, p_target_id: targetId, p_details: details }, "Could not record the owner action.");
  }

  async function listMfaFactors() {
    if (!state.client || !state.user) throw new Error("Authentication required.");
    const { data, error } = await state.client.auth.mfa.listFactors();
    if (error) throw cleanError(error, "Could not load two-factor authentication.");
    return data;
  }

  async function enrollMfa() {
    if (!state.client || !state.user) throw new Error("Authentication required.");
    const { data, error } = await state.client.auth.mfa.enroll({ factorType: "totp", friendlyName: "RepairDesk Owner" });
    if (error) throw cleanError(error, "Could not start two-factor authentication.");
    return data;
  }

  async function verifyMfa(factorId, code) {
    if (!state.client || !state.user) throw new Error("Authentication required.");
    const challenge = await state.client.auth.mfa.challenge({ factorId });
    if (challenge.error) throw cleanError(challenge.error, "Could not create a verification challenge.");
    const result = await state.client.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code: String(code || "").trim() });
    if (result.error) throw cleanError(result.error, "The verification code is invalid.");
    return result.data;
  }

  async function unenrollMfa(factorId) {
    if (!state.client || !state.user) throw new Error("Authentication required.");
    const { data, error } = await state.client.auth.mfa.unenroll({ factorId });
    if (error) throw cleanError(error, "Could not remove two-factor authentication.");
    return data;
  }

  async function updateFeedbackStatus(id, status) {
    if (!state.client || !state.user) throw new Error("Authentication required.");
    const allowed = new Set(["new", "reviewing", "planned", "resolved", "closed"]);
    if (!allowed.has(status)) throw new Error("Invalid feedback status.");
    const { data, error } = await state.client.rpc("set_admin_feedback_status", {
      p_id: Number(id),
      p_status: status,
    });
    if (error) throw cleanError(error, "Could not update feedback.");
    return data;
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
        p_app_version: APP_VERSION,
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
    loadWorkshop,
    saveSnapshot,
    updateProfile,
    submitFeedback,
    loadAdminDashboard,
    loadAdminUsers,
    loadAdminUserDetail,
    loadAdminWorkshops,
    setAdminUserStatus,
    deleteAdminUser,
    exportAdminUser,
    addAdminSupportNote,
    updateAdminFeedback,
    setFeatureFlag,
    publishAnnouncement,
    recordAdminAction,
    updateFeedbackStatus,
    createWorkshopInvite,
    acceptWorkshopInvite,
    updateWorkshopMember,
    loadRuntimeConfig,
    loadPublicRepair,
    respondToEstimate,
    loadPortalUpdates,
    uploadAttachment,
    attachmentUrl,
    deleteAttachment,
    listMfaFactors,
    enrollMfa,
    verifyMfa,
    unenrollMfa,
    track,
    isConfigured: () => state.configured,
    currentUser: () => state.user,
    currentSession: () => state.session,
    deviceId: () => deviceId,
  });
})();
