# RepairDesk

RepairDesk is a responsive, local-first workshop manager for repairs, parts, orders, customers, documents and day-to-day shop activity.

![RepairDesk](https://img.shields.io/badge/RepairDesk-v0.2.1-d9ff63?style=flat-square&labelColor=15231f)
![HTML](https://img.shields.io/badge/HTML5-Project-e34f26?style=flat-square&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-Responsive-1572b6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-f7df1e?style=flat-square&logo=javascript&logoColor=111)
![Supabase](https://img.shields.io/badge/Supabase-Cloud-3ecf8e?style=flat-square&logo=supabase&logoColor=white)

## What is included

- Repair dashboard with live totals and status counts
- Create, edit and delete repair records
- Complete event timeline for every repair
- Searchable repair history with technician notes
- Multiple parts, costs, orders and delivery statuses
- Local parts discovery for 20 countries
- Optional Google Programmable Search results, product images and price comparison
- Customer details and workshop business information
- Numbered receipts and invoices with print-ready A4 output
- 20 interface languages, right-to-left Arabic and worldwide currency selection
- Responsive light and dark interfaces
- Local browser mode with no account required

## Cloud accounts in v0.2.0

- Email registration and sign-in
- Email confirmation and password recovery
- Local-first operation with automatic background synchronisation
- Remembered local-mode choice instead of showing the account prompt after every reload
- Safe migration of existing browser data into an account
- Empty first cloud workspace, without uploading the local demonstration records
- Multi-device merge based on record timestamps and deletion markers
- Optimistic revision checks to prevent silent cloud overwrites
- Bounded retry backoff for temporary cloud failures
- Manual **Sync now** control and clear online, offline and error states
- In-app feedback form for signed-in users
- Product event collection for signed-in accounts without repair or customer contents in event properties
- Private owner dashboard for registrations, daily activity, returning users and feedback triage
- Row-level account isolation for profiles, workshop snapshots, feedback and analytics

## Owner console in v0.2.1

The private owner console adds operational visibility without exposing customer repair contents:

- Six headline metrics for registrations, activity, retention, feedback, cloud workspaces and repairs managed
- Thirty-day activity chart plus event and country breakdowns
- Read-only user directory with email confirmation, workshop locale, last activity, last sync, revision, repair count and snapshot size
- Search and incremental loading for the user directory
- Feedback filtering and audited status changes
- Private database audit log for owner actions
- Spreadsheet-safe CSV export for the currently loaded owner report

Owner access is enforced inside every privileged database function. The browser never receives a secret or service-role credential, and the directory returns workspace metadata only—not repair, customer, invoice or note contents.

The application remains fully usable in local mode when cloud configuration is empty or the network is unavailable.

## Getting started locally

No build step is required.

```bash
git clone https://github.com/Pikaneth/RepairDesk.git
cd RepairDesk
python3 -m http.server 8000
```

Open `http://localhost:8000`.

Opening `index.html` directly is sufficient for most local features, but a local HTTP server is recommended for authentication redirects and consistent browser behaviour.

## Enable registration and cloud sync

RepairDesk uses Supabase Auth and Postgres. The frontend only needs a public project URL and publishable key; all account isolation is enforced in the database.

### 1. Create the database

1. Create a Supabase project.
2. Open its SQL editor.
3. Run the complete [`supabase/schema.sql`](supabase/schema.sql) file.

The script creates profiles, workshop snapshots, feedback, analytics, indexes, triggers, row-level security policies and guarded RPC functions.
It is idempotent and should be run again after upgrading RepairDesk so new owner-console functions and security changes are applied.

### 2. Add the public connection values

Open the project **Connect** dialog or **Project Settings → API Keys**, then copy the project URL and publishable key. Open `config.js` and set both values:

```js
window.REPAIRDESK_CONFIG = Object.freeze({
  supabaseUrl: "https://your-project.supabase.co",
  supabasePublishableKey: "sb_publishable_your_key",
  siteUrl: window.location.origin + window.location.pathname,
  analyticsEnabled: true,
});
```

The publishable key is intended for browser applications. Never place a secret key or service-role key in this repository.

### 3. Configure authentication redirects

In Supabase authentication URL settings, use the deployed application URL as both the site URL and an allowed redirect URL.

For this repository:

```text
https://pikaneth.github.io/RepairDesk/
```

Email confirmation should remain enabled for public registration. Password reset links return to `?recovery=1` and open the secure password update dialog.

### 4. Enable the private owner dashboard

Register through the application first. Then run the following once in the Supabase SQL editor, replacing the email address:

```sql
update public.profiles
set is_admin = true
where id = (
  select id from auth.users where email = 'owner@example.com'
);
```

After the next sign-in, an **Analytics** navigation item appears only for that administrator. The owner console shows registrations, active and returning users, workspace health, aggregate repair counts, account metadata, feedback and audited owner actions.

The owner can also use the direct sign-in URL:

```text
https://pikaneth.github.io/RepairDesk/?admin=1
```

The route still performs the same database role check and falls back to the normal workspace for non-administrator accounts.

The owner directory deliberately does not return repair snapshots. Raw workshop contents remain isolated to their account; the console receives only counts, timestamps, revisions and byte sizes needed for operational support.

## Synchronisation model

RepairDesk writes changes to `localStorage` first, so the interface stays fast and continues working offline. Signed-in changes are queued and uploaded in the background.

Each cloud snapshot has a revision number. If another device updates the same account first, RepairDesk downloads the newer snapshot, merges records by `updatedAt`, applies the newest deletion markers and retries against the latest revision. The server performs the revision check and write in one guarded transaction.

Existing v0.1.x browser data is never uploaded silently. After sign-in, the user chooses whether to merge local records with the account or use an existing cloud workspace. The migration dialog remains open until the choice is complete.

## Analytics and feedback

Signed-in activity records operational events such as application opens, repair creation, completion, deletion, view changes and feedback submission. Event properties contain small categorical values such as repair category, status, language and country; repair descriptions, customer details and document contents are not copied into analytics events.

Feedback messages are stored separately and can be moved through `new`, `reviewing`, `planned`, `resolved` and `closed` states in the owner dashboard.

Set `analyticsEnabled` to `false` in `config.js` to stop event collection while keeping accounts and synchronisation active.

## Security model

- Every exposed table has row-level security enabled.
- Users can read and update only their own account rows.
- Snapshot writes use `save_user_data`, which validates shape, size and expected revision.
- Direct client writes to the snapshot table are not granted.
- Owner metrics require both an authenticated session and the `is_admin` profile flag.
- Secret and service-role credentials are not used by the frontend.
- Authentication sessions use the Supabase browser client with persisted sessions and automatic token refresh.

Workshop snapshots can contain customer information entered by the technician. Production deployments should publish a privacy notice, define a retention policy and configure regional hosting appropriate for their users.

## Parts search

Every selected country has direct search links for established local marketplaces. These links work without an account or configuration.

To show live offers inside RepairDesk:

1. Open **Settings → Parts search**.
2. Create a [Google Programmable Search Engine](https://programmablesearchengine.google.com/controlpanel/create).
3. Copy the recommended store domains into its **Sites to search** list.
4. Paste the `cx` identifier into RepairDesk and test the connection.

Checkout and payment remain on the marketplace. After purchase, mark the selected offer as ordered; the repair moves into the waiting workflow. Mark the part received when it arrives.

## Receipts and invoices

Add workshop identity, contact details, tax rate and payment details in **Settings**. Completed repairs provide separate **Receipt** and **Invoice** actions. Each document receives a stable number and is added to the repair timeline.

Use **Print / Save PDF** in the preview to send the A4 document to a printer or save it as a PDF.

## Project structure

```text
RepairDesk/
├── assets/
│   └── favicon.svg
├── supabase/
│   └── schema.sql
├── tests/
│   ├── cloud-smoke.mjs
│   ├── runtime-smoke.mjs
│   └── smoke.mjs
├── app.js
├── catalog.js
├── cloud.js
├── config.js
├── i18n.js
├── i18n-v012.js
├── i18n-v020.js
├── index.html
├── styles.css
├── LICENSE
└── README.md
```

## Validation

Run the dependency-free test suite with:

```bash
node tests/smoke.mjs
node tests/runtime-smoke.mjs
node tests/cloud-smoke.mjs
```

The checks cover markup and translation integrity, browser-data upgrades, repair history, orders, documents, conflict merging, cloud configuration fallback, authentication state, guarded sync calls, analytics, feedback and row-level security declarations.

## Languages

RepairDesk supports English, Russian, Ukrainian, German, Japanese, French, Italian, Spanish, Portuguese, Simplified Chinese, Hindi, Arabic, Bengali, Turkish, Korean, Indonesian, Polish, Dutch, Vietnamese and Thai. Arabic automatically switches the interface to right-to-left layout.

## Roadmap

- Photo attachments with storage quotas
- JSON import and export
- Tags and custom statuses
- Team accounts and technician roles
- Appointment scheduling
- Inventory and barcode scanning

## Author

**Pikaneth (Sviatoslav)**

## License

Released under the [MIT License](LICENSE).
