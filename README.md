# RepairDesk

> A practical, local-first workspace for repair shops — from the first customer conversation to the final pickup.

![RepairDesk](https://img.shields.io/badge/RepairDesk-v0.3.4-d9ff63?style=flat-square&labelColor=15231f)
![HTML](https://img.shields.io/badge/HTML5-Project-e34f26?style=flat-square&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-Responsive-1572b6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-f7df1e?style=flat-square&logo=javascript&logoColor=111)
![Supabase](https://img.shields.io/badge/Supabase-Cloud-3ecf8e?style=flat-square&logo=supabase&logoColor=white)

[Open the live app](https://pikaneth.github.io/RepairDesk/) · [Run it locally](#running-locally) · [Connect cloud sync](#optional-cloud-sync)

## Why RepairDesk exists

Repair work rarely becomes messy because of one difficult device. The real problem is everything around it: customer details in messages, deadlines on paper, parts in a spreadsheet, payments in a notebook and repair history scattered across several places.

RepairDesk brings those moving parts into one clear workspace. It helps a workshop receive a device, follow the job through each stage, keep parts and costs under control, prepare documents and give the customer a simple way to check progress.

The application is deliberately local-first. It starts working in the browser immediately, keeps an offline copy of the workshop and can add account-based synchronisation when it is needed.

## What is included

| Area | What it helps with |
|---|---|
| Today | See overdue work, pending estimates, upcoming pickups, revenue and low stock at a glance |
| Repairs | Work with a Kanban board or a detailed list, search quickly and move jobs through the workflow |
| Intake | Record the device, issue, condition, accessories, IMEI, priority, tags, consent and signature |
| Customers | Keep contacts, notes, devices, repair history and lifetime value together |
| Devices | Track serial numbers, IMEI, warranty details and every related repair |
| Inventory | Manage SKUs, quantities, shelf locations, compatibility, minimum stock and prices |
| Purchasing | Keep suppliers, purchase orders, tracking numbers, expenses and received stock organised |
| Calendar | Combine appointments, promised dates and repair deadlines in one schedule |
| Money | Prepare estimates, record partial or full payments and follow the remaining balance |
| Documents | Create consistent receipts and invoices with workshop details, logo and signature |
| Customer updates | Share a protected status page and QR code for a specific repair |
| Reports | Review revenue, repair value, average ticket, status distribution and device categories |

## A repair from start to finish

1. **Receive the device.** Add the customer, describe the fault and record the device condition and accessories.
2. **Plan the work.** Set a priority, deadline, tags and the person responsible for the repair.
3. **Diagnose the problem.** Keep technical notes and the history of important changes in the repair card.
4. **Prepare the estimate.** Add the expected amount and record whether the customer approved it.
5. **Handle parts.** Add parts directly to the repair or connect the job with stock and purchasing.
6. **Record payments.** Accept deposits and partial payments while RepairDesk calculates the outstanding balance.
7. **Finish the job.** Print a receipt or invoice, set the warranty period and mark the device ready for pickup.
8. **Keep the history.** Completed repairs remain searchable and warranty returns can be linked to the original job.

## Repair workspace

Each repair has its own focused workspace instead of one oversized form. The tabs separate the information that matters during different parts of the job:

- overview and current status;
- diagnosis and workshop notes;
- parts and labour;
- estimate and customer response;
- payments and balance;
- receipts and invoices;
- photos and attachments;
- customer status page;
- complete change history.

Repairs can be shown as a Kanban board or a compact table. Saved filters, bulk actions, keyboard shortcuts and fast search keep the interface useful when the number of jobs grows.

## Customers, devices and stock

Customer and device records are built from the repair workflow, so the same information does not need to be entered again and again. A customer card shows contact details, notes, devices, previous work and total repair value. A device record keeps its identifiers, warranty information and repair history.

Inventory is connected to day-to-day workshop work. Every stock item can include:

- a SKU and category;
- quantity and minimum stock level;
- purchase and sale price;
- compatible devices;
- supplier and shelf location.

Purchase orders keep the supplier, order state, tracking number, parts and total expense together. When an order arrives, its items can be received into stock without re-entering them manually.

## Local-first and offline use

RepairDesk writes changes to the browser first. The interface remains responsive even on an unreliable connection, and the service worker keeps the application shell available offline.

The local workflow includes:

- automatic saving while a new repair is being filled in;
- undo and Trash for recoverable deletion;
- complete JSON backup and restore;
- spreadsheet-safe CSV export;
- an installable PWA experience on supported devices.

Signing in is optional. On the first cloud sign-in, RepairDesk asks whether to merge the existing local workshop or use the cloud copy. Local records are never uploaded silently.

## Try the live app

Open [pikaneth.github.io/RepairDesk](https://pikaneth.github.io/RepairDesk/).

The first launch asks for a language, country and currency. After that, choose **Continue locally** to explore the interface without creating an account. The demo includes sample repairs, so the main screens and reports are useful immediately.

## Running locally

RepairDesk uses plain HTML, CSS and JavaScript. There is no build step.

```bash
git clone https://github.com/Pikaneth/RepairDesk.git
cd RepairDesk
python3 -m http.server 8000
```

Open `http://localhost:8000` in a browser.

Opening `index.html` directly is enough for many local features, but a small HTTP server is recommended because service workers and authentication redirects require it.

## Optional cloud sync

Cloud accounts, synchronisation and private attachments use Supabase Auth, Postgres and Storage. Only the public project URL and publishable key belong in the frontend:

```js
window.REPAIRDESK_CONFIG = Object.freeze({
  supabaseUrl: "https://your-project.supabase.co",
  supabasePublishableKey: "sb_publishable_your_key",
  siteUrl: window.location.origin + window.location.pathname,
});
```

Never place a secret key or service-role key in this repository.

In Supabase, set **Authentication → URL Configuration** to the deployed application URL. For this repository, both the site URL and allowed redirect URL are:

```text
https://pikaneth.github.io/RepairDesk/
```

Keep email confirmation enabled. Password reset links return to `?recovery=1`.

### Database setup and updates

1. Open the Supabase project.
2. Go to **SQL Editor** and create a new query.
3. Copy the complete [`supabase/schema.sql`](supabase/schema.sql) file into the editor.
4. Click **Run** and wait for `Success. No rows returned`.
5. Refresh RepairDesk and sign in again.

The script is transactional and idempotent. It can be run on an existing installation and preserves the legacy snapshot while moving its records into the current workshop model.

The matching versioned migration is stored at [`supabase/migrations/202608260034_repairdesk_v034.sql`](supabase/migrations/202608260034_repairdesk_v034.sql).

## How synchronisation works

Every signed-in workshop has a cloud snapshot and a revision number. RepairDesk saves locally first, then sends the current revision in the background. If another device has already changed the workshop, records are compared by their update time, deletions are applied and the merged revision is retried.

The snapshot remains the portable offline format. At the same time, the database maintains structured records for repairs, customers, devices, stock, orders, appointments, payments and documents. This keeps the browser workflow simple while allowing the database to validate access and serve limited customer status pages safely.

## Security and privacy

- Row Level Security is enabled for account and workshop data.
- Workshop membership and account state are checked by the database.
- Sensitive writes go through guarded database functions instead of unrestricted table updates.
- Attachments are stored in a private bucket with workshop-specific path rules.
- Customer status tokens are long random values and are stored as SHA-256 hashes.
- A customer status page receives only the small repair summary it needs.
- The frontend contains no secret or service-role credentials.

Repair records may contain personal information and device access details. A real deployment should publish a privacy notice, define retention rules and choose the appropriate Supabase region.

## Documents and backups

- **Settings → Data** exports a complete JSON backup or a CSV repair list.
- Deleted repairs stay in Trash until they are restored or permanently removed.
- Receipt and invoice numbers remain stable after a document is created.
- Document templates can include a workshop name, logo, signature, payment details and footer.
- Offline edits stay in the local copy and synchronise after the connection returns.

## Project structure

```text
RepairDesk/
├── assets/
│   ├── app-icon.svg
│   └── favicon.svg
├── supabase/
│   ├── migrations/
│   │   └── 202608260034_repairdesk_v034.sql
│   └── schema.sql
├── tests/
│   ├── browser-v034.mjs
│   ├── cloud-smoke.mjs
│   ├── release-v034.mjs
│   ├── runtime-smoke.mjs
│   └── smoke.mjs
├── app.js
├── catalog.js
├── cloud.js
├── config.js
├── i18n.js
├── i18n-v012.js
├── i18n-v020.js
├── i18n-v034.js
├── index.html
├── manifest.webmanifest
├── styles.css
├── styles-v034.css
├── sw.js
├── v034.js
├── LICENSE
└── README.md
```

## Validation

Run the dependency-free checks:

```bash
node tests/smoke.mjs
node tests/runtime-smoke.mjs
node tests/cloud-smoke.mjs
node tests/release-v034.mjs
```

For the full browser workflow, install Playwright and Chromium, start the local server and run:

```bash
python3 -m http.server 8000
node tests/browser-v034.mjs
```

The checks cover markup, translations, local migration, conflict merging, authenticated cloud access, database policies, navigation, intake, customers, devices, inventory, calendar, payments, estimates, customer status pages and reports.

For a production Supabase project, also review **Security Advisor** and **Performance Advisor** after applying the schema.

## Languages

RepairDesk supports English, Russian, Ukrainian, German, Japanese, French, Italian, Spanish, Portuguese, Simplified Chinese, Hindi, Arabic, Bengali, Turkish, Korean, Indonesian, Polish, Dutch, Vietnamese and Thai.

Arabic automatically switches the interface to a right-to-left layout.

## Built with

- semantic HTML;
- responsive CSS;
- vanilla JavaScript;
- Supabase Auth, Postgres and Storage;
- browser storage and service workers;
- GitHub Pages.

## Author

**Pikaneth (Sviatoslav)**

## License

Released under the [MIT License](LICENSE).
