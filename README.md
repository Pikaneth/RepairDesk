# RepairDesk

RepairDesk is a local-first workshop operating system for repairs, customers, devices, inventory, purchasing, appointments, payments, documents and owner analytics.

![RepairDesk](https://img.shields.io/badge/RepairDesk-v0.3.4-d9ff63?style=flat-square&labelColor=15231f)
![HTML](https://img.shields.io/badge/HTML5-Project-e34f26?style=flat-square&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-Responsive-1572b6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-f7df1e?style=flat-square&logo=javascript&logoColor=111)
![Supabase](https://img.shields.io/badge/Supabase-Cloud-3ecf8e?style=flat-square&logo=supabase&logoColor=white)

Live application: [pikaneth.github.io/RepairDesk](https://pikaneth.github.io/RepairDesk/)

## Version 0.3.4

### Workshop workspace

- Today dashboard with due, overdue, approval, pickup, revenue and low-stock indicators
- Kanban and table repair views with drag-and-drop status changes
- Intake workflow with priority, tags, technician, IMEI, condition, accessories, consent and signature
- Repair cards with overview, diagnosis, parts, estimate, payments, documents, attachments, portal and history tabs
- Customer CRM with contact details, repair history and lifetime value
- Device registry with serial number, IMEI, warranty and repair history
- Inventory with SKU, compatibility, stock thresholds, location, cost and sale price
- Supplier directory and purchase orders with tracking, expenses and stock receiving
- Appointment calendar combined with repair deadlines
- Estimates with customer approval or rejection
- Multiple and partial payments with method, balance and profit calculations
- Secure customer status links and QR codes
- Warranty returns linked to the original repair
- Team invitations with owner, manager, technician and viewer roles
- Branded receipt and invoice templates with logo, signature, payment details and reusable text
- JSON backup and restore, CSV export, trash, undo and intake autosave
- Bulk repair actions, saved filters, keyboard shortcuts and fast search
- Installable PWA shell with offline application assets

### Private owner console

The owner console is a separate privileged area with:

- Overview, users, workshops, analytics, feedback, system, security and releases sections
- Custom date ranges and comparison with the previous period
- DAU, WAU, MAU, returning-user, churn and retention views
- Registration funnel, activity chart, product events and feature usage
- Searchable user directory with operational filters
- User profile details, recent devices, sync health, feedback and private support notes
- Password-reset email, suspend/restore, account export and confirmed account deletion actions
- Workshop directory with members, repair/customer totals, revision and storage size
- Feedback priority, category, owner notes, workflow state and linked release
- Sync success rate, conflicts, stale workshops, database size and attachment usage
- Feature flags, rollout percentage, maintenance mode, minimum version and announcements
- Owner MFA setup and a private audit log
- Release history, version adoption and deployment state

Owner data is not protected by a hidden button alone. Every privileged database function checks the authenticated account's `is_admin` flag. Normal users cannot call owner reports or mutations, and they never receive the owner navigation item.

## Update an existing installation to 0.3.4

GitHub Pages publishes the frontend but cannot change Supabase automatically. Apply the database update once after deploying the code:

1. Open the Supabase project.
2. Go to **SQL Editor** and create a new query.
3. Copy the complete [`supabase/schema.sql`](supabase/schema.sql) file into the editor.
4. Click **Run** and wait for `Success. No rows returned`.
5. Hard-refresh RepairDesk and sign in again.

The script is transactional and idempotent. Existing account snapshots are copied into the new workshop model without deleting the legacy source data. It can be run again safely when updating the application.

The versioned migration snapshot is also stored at [`supabase/migrations/202608260034_repairdesk_v034.sql`](supabase/migrations/202608260034_repairdesk_v034.sql).

## Owner sign-in guide

### First-time owner setup

1. Register normally in RepairDesk and confirm the email address.
2. Run `supabase/schema.sql` as described above.
3. In Supabase **SQL Editor**, run this once with the owner's real email:

```sql
update public.profiles
set is_admin = true,
    account_status = 'active'
where id = (
  select id
  from auth.users
  where lower(email) = lower('owner@example.com')
);
```

4. Sign out of RepairDesk and sign in again.
5. Click **Owner panel** at the bottom of the main navigation.

Direct owner sign-in URL:

```text
https://pikaneth.github.io/RepairDesk/?admin=1
```

The direct URL performs the same server-side role check. A non-owner is returned to the normal workshop.

### Verify owner access

```sql
select u.email, p.is_admin, p.account_status
from public.profiles p
join auth.users u on u.id = p.id
where p.is_admin = true;
```

Only explicitly promoted rows should be returned. Browser users cannot promote themselves because authenticated clients have no update grant on `is_admin` or `account_status`.

### Enable owner 2FA

Open **Owner panel → Security → Enable 2FA**, scan the QR code with an authenticator, enter the six-digit code and verify it. The factor is stored by Supabase Auth; no MFA secret is written to RepairDesk data.

## Getting started locally

No build step is required.

```bash
git clone https://github.com/Pikaneth/RepairDesk.git
cd RepairDesk
python3 -m http.server 8000
```

Open `http://localhost:8000`.

Opening `index.html` directly works for most local features, but an HTTP server is required for service workers and is recommended for authentication redirects.

## Cloud configuration

RepairDesk uses Supabase Auth, Postgres and Storage. The frontend needs only the public project URL and publishable key:

```js
window.REPAIRDESK_CONFIG = Object.freeze({
  supabaseUrl: "https://your-project.supabase.co",
  supabasePublishableKey: "sb_publishable_your_key",
  siteUrl: window.location.origin + window.location.pathname,
  analyticsEnabled: true,
});
```

Never place a secret key or service-role key in this repository.

In **Authentication → URL Configuration**, set both the site URL and an allowed redirect URL to:

```text
https://pikaneth.github.io/RepairDesk/
```

Email confirmation should remain enabled. Password reset links return to `?recovery=1`.

## Data and synchronisation model

RepairDesk saves locally first and synchronises signed-in changes in the background. Each workshop snapshot has a revision. A conflicting device receives the newer revision, merges records by `updatedAt`, applies deletion markers and retries.

Version 0.3.4 keeps the snapshot as the offline interchange format and rebuilds normalized operational indexes in the same transaction. The indexed tables power owner analytics without exposing raw workshop snapshots in ordinary reports.

Existing browser data is never uploaded silently. On first sign-in, the user chooses whether to merge local data or use the cloud workshop.

## Roles

| Role | Workshop data | Repair changes | Team management | Owner console |
|---|---:|---:|---:|---:|
| Owner | Read | Write | Yes | Only with `is_admin` |
| Manager | Read | Write | Yes | No |
| Technician | Read | Write | No | No |
| Viewer | Read | No | No | No |

These permissions are checked in the database RPC layer as well as the interface.

## Security model

- RLS is enabled for profiles, legacy snapshots, feedback, analytics and every new workshop table.
- Direct table access is revoked where writes must pass through guarded RPC functions.
- Workshop membership and active-account state are checked server-side.
- Viewer accounts cannot save workshop snapshots.
- Owner RPCs require an authenticated active profile with `is_admin = true`.
- Privileged functions use a fixed empty `search_path` and schema-qualified objects.
- Attachments use a private Storage bucket and workshop-ID path policies.
- Customer portal tokens are high-entropy values stored only as SHA-256 hashes in indexed records.
- Portal responses expose a deliberately limited repair status projection.
- Owner mutations create audit records.
- The frontend contains no secret or service-role credential.

Workshop records may contain personal data and device access information. Production operators should publish a privacy notice, define retention rules and use the appropriate Supabase region.

## Backup, documents and offline use

- **Settings → Data** exports or imports a complete JSON backup and exports repairs as spreadsheet-safe CSV.
- Deleted repairs remain in Trash until restored or explicitly emptied.
- Receipt and invoice numbering stays stable after the document is first created.
- Custom document titles, logo, signature, payment details and footer are included in print output.
- The service worker caches the application shell; edits remain local while offline and synchronise after reconnecting.

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

With Playwright and Chromium installed, start the local server and run the end-to-end workflow:

```bash
python3 -m http.server 8000
node tests/browser-v034.mjs
```

The suite covers markup and translations, data migration, conflict merging, guarded cloud RPCs, RLS declarations, analytics, feedback, navigation, intake, CRM, device registry, inventory, calendar, payments, estimates, customer portal and reports.

After applying the schema, also run Supabase **Security Advisor** and **Performance Advisor** for the production project.

## Languages

RepairDesk supports English, Russian, Ukrainian, German, Japanese, French, Italian, Spanish, Portuguese, Simplified Chinese, Hindi, Arabic, Bengali, Turkish, Korean, Indonesian, Polish, Dutch, Vietnamese and Thai. Arabic switches the interface to right-to-left layout.

## Author

**Pikaneth (Sviatoslav)**

## License

Released under the [MIT License](LICENSE).
