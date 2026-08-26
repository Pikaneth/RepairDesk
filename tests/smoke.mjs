import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), "utf8");
const html = read("index.html");
const app = read("app.js");
const cloud = read("cloud.js");
const extension = read("v034.js");
const styles = `${read("styles.css")}\n${read("styles-v034.css")}`;

for (const file of ["styles.css", "styles-v034.css", "config.js", "i18n.js", "i18n-v012.js", "i18n-v020.js", "i18n-v034.js", "catalog.js", "cloud.js", "v034.js", "app.js", "manifest.webmanifest", "sw.js", "assets/app-icon.svg", "supabase/schema.sql", "supabase/migrations/202608260034_repairdesk_v034.sql"]) {
  assert.ok(fs.existsSync(new URL(file, root)), `${file} is missing`);
}

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "HTML contains duplicate IDs");

const idBlock = app.match(/Object\.fromEntries\(\[([\s\S]*?)\]\.map\(\(id\)/)?.[1] || "";
const referencedIds = [...idBlock.matchAll(/"([A-Za-z][A-Za-z0-9]+)"/g)].map((match) => match[1]);
for (const id of referencedIds) assert.ok(ids.includes(id), `Missing HTML element #${id}`);

for (const id of ["overviewView", "historyView", "settingsView", "adminView", "adminUsersTableBody", "adminAuditLog", "finderDialog", "documentDialog", "countryStep", "authDialog", "accountDialog", "feedbackDialog", "migrationDialog"]) {
  assert.ok(ids.includes(id), `Required workspace #${id} is missing`);
}
assert.match(html, /class="version-badge">0\.3\.4</, "The interface version must be 0.3.4");
assert.match(cloud, /const APP_VERSION = "0\.3\.4"/, "Cloud events must use the interface version");
assert.match(extension, /const VERSION = "0\.3\.4"/, "The operations interface must use the release version");
assert.match(html, /rel="manifest" href="manifest\.webmanifest"/, "The installable app manifest must be linked");
assert.equal(read("supabase/migrations/202608260034_repairdesk_v034.sql"), read("supabase/schema.sql"), "The release migration must match the canonical idempotent schema");
assert.match(read("README.md"), /RepairDesk-v0\.3\.4/, "The release guide must show v0.3.4");

const publicConfig = read("config.js");
assert.doesNotMatch(publicConfig, /service[_-]?role|secret[_-]?key/i, "Public configuration must not contain privileged credentials");
assert.match(app, /CLOUD_SYNC_RETRY_MAX\s*=\s*60000/, "Persistent cloud errors must use bounded retry backoff");
assert.match(app, /else \{\s*cloudRevision = null;\s*repairs = \[\];\s*deletedRepairs = \[\];[\s\S]*?await performCloudSync\(\);\s*\}/, "A new account must not upload demonstration repairs as workshop data");

const cssWithoutComments = styles.replace(/\/\*[\s\S]*?\*\//g, "");
assert.match(cssWithoutComments, /\[hidden\]\s*\{[^}]*display\s*:\s*none\s*!important\s*;/, "Hidden interface states must not be overridden by component display rules");
let braceDepth = 0;
for (const character of cssWithoutComments) {
  if (character === "{") braceDepth += 1;
  if (character === "}") braceDepth -= 1;
  assert.ok(braceDepth >= 0, "CSS closes a block before it opens");
}
assert.equal(braceDepth, 0, "CSS contains an unclosed block");

const context = { Intl, URL, URLSearchParams };
vm.createContext(context);
vm.runInContext(`${read("i18n.js")}\n${read("i18n-v012.js")}\n${read("i18n-v020.js")}\n${read("i18n-v034.js")}\nthis.translations = RepairDeskI18n;`, context);
assert.equal(context.translations.languages.length, 20, "Expected 20 languages");
assert.equal(Object.keys(context.translations.messages).length, 20, "Expected 20 message catalogs");

const englishKeys = Object.keys(context.translations.messages.en);
for (const language of context.translations.languages) {
  const catalog = context.translations.messages[language.code];
  assert.ok(catalog, `Missing messages for ${language.code}`);
  for (const key of englishKeys) assert.ok(key in catalog, `${language.code} is missing ${key}`);
}

const literalKeys = new Set();
for (const match of app.matchAll(/\bt\(\s*["']([^"']+)["']/g)) literalKeys.add(match[1]);
for (const match of extension.matchAll(/\btr\(\s*["']([^"']+)["']/g)) literalKeys.add(match[1]);
for (const match of html.matchAll(/data-i18n(?:-placeholder|-aria)?="([^"]+)"/g)) literalKeys.add(match[1]);
for (const key of literalKeys) assert.ok(key in context.translations.messages.en, `Missing English message: ${key}`);

for (const feature of ["repairs", "customers", "devices", "inventory", "calendar", "reports", "payments", "estimate", "portal", "teamAccess", "ownerSecurity", "featureFlags"]) {
  assert.match(extension, new RegExp(feature, "i"), `v0.3.4 must include ${feature}`);
}
assert.match(extension, /savedFilters[\s\S]*saveCurrentFilter/, "Saved repair filters are required");
assert.match(extension, /runtimeRestriction[\s\S]*minimum_app_version/, "Owner runtime controls must enforce maintenance and minimum version settings");
assert.doesNotMatch(extension, /getElementById\("rdEntityForm"\)\?\.addEventListener\("submit"/, "The entity form must not be registered twice");
assert.match(app, /\^custom-\[a-z0-9-\]/, "Custom workflow statuses must survive normalization");

vm.runInContext(`${read("catalog.js")}\nthis.partsCatalog = RepairDeskCatalog;`, context);
assert.equal(context.partsCatalog.countries.length, 20, "Expected 20 countries");
for (const country of context.partsCatalog.countries) {
  const providers = context.partsCatalog.providerList(country.code);
  assert.ok(providers.length >= 4, `${country.code} needs at least four store providers`);
  for (const provider of providers) {
    assert.match(provider.url, /^https:\/\//, `${provider.name} must use HTTPS`);
    assert.ok(provider.domain, `${provider.name} needs a domain`);
  }
}

console.log(`RepairDesk smoke checks passed: ${ids.length} IDs, ${englishKeys.length} messages, 20 countries.`);
