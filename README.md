# RepairDesk

RepairDesk is a responsive, local-first workshop manager for repairs, parts, orders, customers, documents and day-to-day shop activity.

![RepairDesk](https://img.shields.io/badge/RepairDesk-v0.2.0-d9ff63?style=flat-square&labelColor=15231f)
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
- Safe migration of existing browser data into an account
- Multi-device merge based on record timestamps and deletion markers
- Optimistic revision checks to prevent silent cloud overwrites
- Manual **Sync now** control and clear online, offline and error states
- In-app feedback form for signed-in users
- Product event collection for signed-in accounts without repair or customer contents in event properties
- Private owner dashboard for registrations, daily activity, returning users and feedback triage
- Row-level account isolation for profiles, workshop snapshots, feedback and analytics

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

### 2. Add the public connection values

Open `config.js` and set the project URL and publishable key:

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

After the next sign-in, an **Analytics** navigation item appears only for that administrator. The dashboard shows total and new registrations, active users, returning users, events by day and the latest feedback messages.

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
