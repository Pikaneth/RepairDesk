import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), "utf8");
const html = read("index.html");
const app = read("app.js");
const styles = read("styles.css");

for (const file of ["styles.css", "i18n.js", "i18n-v012.js", "catalog.js", "app.js"]) {
  assert.ok(fs.existsSync(new URL(file, root)), `${file} is missing`);
}

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "HTML contains duplicate IDs");

const idBlock = app.match(/Object\.fromEntries\(\[([\s\S]*?)\]\.map\(\(id\)/)?.[1] || "";
const referencedIds = [...idBlock.matchAll(/"([A-Za-z][A-Za-z0-9]+)"/g)].map((match) => match[1]);
for (const id of referencedIds) assert.ok(ids.includes(id), `Missing HTML element #${id}`);

for (const id of ["overviewView", "historyView", "settingsView", "finderDialog", "documentDialog", "countryStep"]) {
  assert.ok(ids.includes(id), `Required workspace #${id} is missing`);
}

const cssWithoutComments = styles.replace(/\/\*[\s\S]*?\*\//g, "");
let braceDepth = 0;
for (const character of cssWithoutComments) {
  if (character === "{") braceDepth += 1;
  if (character === "}") braceDepth -= 1;
  assert.ok(braceDepth >= 0, "CSS closes a block before it opens");
}
assert.equal(braceDepth, 0, "CSS contains an unclosed block");

const context = { Intl, URL, URLSearchParams };
vm.createContext(context);
vm.runInContext(`${read("i18n.js")}\n${read("i18n-v012.js")}\nthis.translations = RepairDeskI18n;`, context);
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
for (const match of html.matchAll(/data-i18n(?:-placeholder|-aria)?="([^"]+)"/g)) literalKeys.add(match[1]);
for (const key of literalKeys) assert.ok(key in context.translations.messages.en, `Missing English message: ${key}`);

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
