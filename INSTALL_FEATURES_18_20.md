# ProcureFlow — Features 18–20 (changed files only)

Base: `Procurement-System(5).zip`, with subsequent Delegation/Budget updates and Admin-only terminology preserved.

## New capabilities

### 18. Supplier Performance Analytics
- New **Supplier Performance Analytics** navigation module for Admin, Procurement Head and Procurement Officer.
- Suppliers see **My Performance**, limited by their authenticated company/supplier ID in the Worker.
- Tracks purchase-order count, delivery reliability (on-time rate), inspected quality rejection rate, verified deliveries and average supplier rating.
- Pricing history separates unit cost from awarded POs (total cost / quantity) and submitted bid unit quotes; filter by item, and export filtered CSV.
- `N/A` means there are no qualifying measured deliveries. Historical totals come from existing stored transaction records; no migration or fabricated sample data.

### 19. Activity Log Enhancements
- The existing Admin Audit Logs screen now has **Change Evidence** and **Activity History** tabs.
- New backend-owned `audit_evidence` records with timestamp, actor, action, entity, before and after snapshots. Client-provided `auditLogs` cannot forge entries in this server-owned table.
- Administrative review with `Unreviewed`, `Reviewed`, or `Flagged`, review notes, and append-only review decision history.
- Filter by date, status, actor/reference/action; export the current page to JSON or CSV.
- Audits edits to enterprise-state business arrays and access-control settings, user account status/role edits, and contract creation/edit/renewal/termination. Other dedicated endpoint activity continues to appear in its own existing logs and is **not yet included** in the new server-owned evidence list.
- The original activity history is retained. No automatic historical backfill into `audit_evidence`. A single snapshot save caps granular evidence at 45 records, then adds a summary entry for remaining changed records. Sensitive field names are excluded, and long values are truncated.

### 20. Mobile PWA Support
- Installable manifest with PF Corp branding and 192/512 px application icons, service worker, mobile quick-action bar (Home/Requests/Approvals/Alerts, or supplier Home/Meetings/Orders/Alerts), and installation help.
- Opt-in device notifications driven by the existing 30-second cloud notification polling **while the app is open**. Opening the alert navigates to the corresponding allowed module.
- Service worker caches **only public app assets** (HTML, scripts, styles, app icons). It does not cache private API responses, authenticated procurement data or documents. Offline edits are not supported.
- **Not remote push:** alerts are not delivered to a fully closed app. Implementing closed-app push would need a separate server push subscription/delivery setup.
- Browser requirements: HTTPS and PWA/Notification support. On iOS: use Safari → Share → Add to Home Screen. Notification availability varies by browser/device.

## Installation / Deployment

Extract this ZIP at the root of your existing ProcureFlow project, keeping directory paths unchanged. **Back up your existing D1 database and source files first.**

1. **Run this additive migration BEFORE deploying the new Worker.** From your project's `cloudflare` directory:

```sh
npx wrangler d1 execute procureflowcorp-db --remote --file=migrations/0016_supplier_analytics_audit_evidence.sql
```

2. Deploy the Worker in the same directory:

```sh
npx wrangler deploy
```

3. Redeploy your Cloudflare Pages frontend (or its GitHub-connected deployment). From the project root:

```sh
npm install
npm run build
```

Deploy the **complete generated `dist/`** directory, which includes `manifest.webmanifest`, `sw.js` and `pwa-*.png`. If Pages is GitHub-connected, commit and push the changed files, letting Pages build them.

4. Hard refresh the page. On phones, choose Install/Add to Home Screen. Grant notifications by tapping the notification toggle; this is opt-in.

## Verification

- Frontend TypeScript: passed.
- Worker TypeScript: passed.
- Supplier analytics and server access rules: 17 targeted smoke assertions passed (includes audit evidence generation and PWA asset checks).
- D1 migration: SQLite compatibility and review-history inserts passed.
- Service worker JavaScript syntax: passed.
- Full Vite production build could **not** be run in this container because the uploaded `node_modules` folder lacks the Linux Rollup optional binary (`@rollup/rollup-linux-x64-gnu`). Run `npm install` on a machine with access to the npm registry and then `npm run build`.
- Not verified against your live D1 instance or deployed website.

No existing table or business record is dropped or overwritten by migration 0016.
