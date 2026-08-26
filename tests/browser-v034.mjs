import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error" && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
await page.addInitScript(() => {
  localStorage.setItem("repairdesk.settings.v1", JSON.stringify({
    language: "ru", country: "DE", currency: "EUR", setupComplete: true, setupVersion: 2,
    workshop: { name: "Browser Test", invoicePrefix: "RD", taxRate: 0 }, workspace: {}, search: {}, updatedAt: new Date().toISOString(),
  }));
  localStorage.setItem("repairdesk.cloud.local-mode.v1", "1");
  localStorage.setItem("repairdesk.repairs.v1", "[]");
});
await page.goto("http://127.0.0.1:8000/", { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-view-target="repairs"]');
assert.equal(await page.locator(".version-badge").first().textContent(), "0.3.4");
assert.equal(await page.locator(".sidebar .nav-item").count(), 9);

await page.locator('[data-view-target="repairs"]').first().click();
await page.waitForSelector("#repairsView:not([hidden])");
assert.ok(await page.locator(".rd-kanban-column").count() >= 8);
await page.locator('[data-rd-action="new-repair"]').first().click();
await page.locator("#deviceInput").fill("Apple iPhone 15 Pro");
await page.locator("#issueInput").fill("Display replacement");
await page.locator("#customerNameInput").fill("Sviatoslav Test");
await page.locator("#customerEmailInput").fill("test@example.com");
await page.locator("#rdImeiInput").fill("123456789012345");
await page.locator("#rdTagsInput").fill("urgent, warranty");
await page.locator("#rdPriorityInput").selectOption("urgent");
await page.locator("#rdConditionInput").fill("Small scratch on the frame");
await page.locator("#repairForm button[type=submit]").click();
await page.waitForSelector('.rd-kanban-card:has-text("Apple iPhone 15 Pro")');

await page.locator('[data-view-target="customers"]').first().click();
await page.waitForSelector('#customersView:not([hidden])');
assert.equal(await page.locator('.rd-record-card:has-text("Sviatoslav Test")').count(), 1);
await page.locator('[data-view-target="devices"]').first().click();
await page.waitForSelector('#devicesView:not([hidden])');
assert.equal(await page.locator('tr:has-text("Apple iPhone 15 Pro")').count(), 1);

await page.locator('[data-view-target="inventory"]').first().click();
await page.locator('[data-rd-action="add-stock"]').last().click();
await page.locator('#rdEntityForm [name="name"]').fill("OLED display");
await page.locator('#rdEntityForm [name="sku"]').fill("OLED-IP15P");
await page.locator('#rdEntityForm [name="quantity"]').fill("2");
await page.locator('#rdEntityForm [name="minimumQuantity"]').fill("3");
await page.locator('#rdEntityForm button[type=submit]').click();
await page.waitForSelector('tr:has-text("OLED-IP15P")');
assert.ok(await page.locator("tr.rd-low-stock").count() >= 1);

await page.locator('[data-view-target="calendar"]').first().click();
await page.waitForSelector('#calendarView:not([hidden])');
await page.locator('[data-rd-action="add-appointment"]').first().click();
await page.locator('#rdEntityForm [name="title"]').fill("Customer pickup");
const start = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
await page.locator('#rdEntityForm [name="startsAt"]').fill(start);
await page.locator('#rdEntityForm button[type=submit]').click();
await page.waitForSelector('.rd-agenda-item:has-text("Customer pickup")');

await page.locator('[data-view-target="repairs"]').first().click();
await page.locator('.rd-kanban-card:has-text("Apple iPhone 15 Pro") [data-rd-action="open-repair"]').click();
await page.waitForSelector("#rdDetailDialog[open]");
await page.locator('[data-detail-tab="payments"]').click();
await page.locator('#rdPaymentForm [name="amount"]').fill("50");
await page.locator('#rdPaymentForm button[type=submit]').click();
await page.waitForSelector('.rd-payment-list article:has-text("50")');
await page.locator('[data-detail-tab="estimate"]').click();
await page.locator('#rdEstimateForm [name="amount"]').fill("299");
await page.locator('#rdEstimateForm [name="status"]').selectOption("sent");
await page.locator('#rdEstimateForm button[type=submit]').click();
await page.locator('[data-detail-tab="portal"]').click();
await page.locator('[data-rd-action="create-portal"]').click();
await page.waitForSelector(".rd-portal-manage");
assert.match(await page.locator(".rd-link-value").textContent(), /\?portal=/);

await page.locator('[data-rd-action="close-detail"]').click();
await page.locator('[data-view-target="reports"]').first().click();
await page.waitForSelector('#reportsView:not([hidden])');
assert.ok(await page.locator(".rd-report-grid .rd-metric").count() >= 5);

assert.deepEqual(errors, [], `Browser errors: ${errors.join(" | ")}`);
await browser.close();
console.log("RepairDesk v0.3.4 browser checks passed: navigation, intake, CRM, devices, stock, calendar, repair details, finance, portal and reports.");
