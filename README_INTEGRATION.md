# ProcureFlow Features 9–11 — compatible with Procurement-System(3).zip

This patch is built from your latest uploaded **Procurement-System(3).zip**, not an older GitHub revision. It adds:

- **Supplier Messaging**: private D1-backed discussions attached to bids, proposal meetings, purchase orders, deliveries, and amendments. Participant access is checked in the Worker.
- **Bidding Deadlines**: Admin or Procurement Head configures a per-need closing time. Worker rejects late submissions even if someone manipulates browser code. No deadline means submissions are closed until staff schedules one.
- **Supplier Accreditation**: suppliers upload registration, tax, and business-permit documents through the existing DOCUMENTS KV binding; Admin/Procurement Head reviews and approves. Required documents have expiration checks. New bids require approved accreditation.

## Changes relative to your newest ZIP

- `src/components/Sidebar.tsx` retains your **working imported logo**, scroll-position restoration, notification badge, and **Admin-only Reset System Database**. Adds only Messaging and Accreditation navigation.
- `src/events/mainEvents.ts` integrates secured bid submission and removes the **duplicate `financeAPI` import** found in your uploaded ZIP; existing invoice and approval handlers remain.
- `cloudflare/src/index.ts` is **not included**. The `scripts/merge-sourcing-worker.mjs` script patches your current file with a backup instead of replacing login, document, notification, recovery, finance, and approval routes.
- Other existing files are only changed to register sourcing tabs and bidding cutoff UI, based on the uploaded ZIP.
- `src/main.tsx` removes a pre-existing unused React import that otherwise triggers `TS6133` in your project's strict build.

## Install

1. Back up your current project folder. Extract only the files from this ZIP into the project root, preserving the `src`, `cloudflare`, and `scripts` paths. Do **not** copy `node_modules` or overwrite your existing Worker `index.ts`.
2. Apply the D1 migration and then merge the Worker from the **project root**:

```powershell
cd D:\GitHub\Procurement-System\cloudflare
npx wrangler d1 execute procureflowcorp-db --remote --file=./migrations/0009_supplier_sourcing.sql
cd ..
node scripts/merge-sourcing-worker.mjs
```

3. Inspect `git diff cloudflare/src/index.ts` before deploying. The script creates a timestamped `.bak` file and is safe to rerun.
4. Deploy Worker and build frontend:

```powershell
cd cloudflare
npx wrangler deploy
cd ..
npm run build
```

5. Publish the frontend to GitHub Pages using your established deployment process.
6. With an Admin/Procurement Head account approve supplier accreditation; configure a deadline for each published stock need. Then test with a supplier account.

## Notes / safeguards

- **No D1 reset** is needed; the migration adds new tables with `IF NOT EXISTS`.
- Uploads use your existing `DOCUMENTS` KV binding, not R2.
- New bids must pass Cloudflare server checks. Older bids remain viewable.
- This update preserves registered users, paid invoices, approval history, document files, and existing account permissions.
- No live deployment was performed. Verify in your Cloudflare account and after GitHub Pages publish.
- The shared legacy `enterprise-state` snapshot is still a broad-access design. The new sourcing APIs enforce participant permissions themselves; full per-record isolation of all older procurement data remains future work.
- The new code does not contain a standalone scheduled job; a bid is automatically closed by enforcing the deadline during submission.
- Your existing dedicated Admin reset endpoint may not yet clear the **new** sourcing tables. Verify this before relying on reset to erase sourcing conversations and deadlines.
