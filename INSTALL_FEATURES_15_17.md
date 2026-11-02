# ProcureFlow — Features 15–17 (Changed Files Only)

This patch was based on the uploaded **Procurement-System(5).zip** (including the latest supplier meeting-reschedule and separated bidding modules). The ZIP is **not** a replacement for the entire project; extract/copy its files over the matching project-relative paths.

## Added modules

### 15 — Global Search & Filters
- New **Global Search & Filters** sidebar item for internal accounts.
- Keyword search and filters for transaction reference, supplier, department, status, record type, and inclusive date range.
- Covers requisitions, stock needs, bids, proposal meetings, purchase orders, deliveries, amendments, payments, plus contracts for permitted users.
- Search results link to their source modules. The existing module permissions and employee/department scope are honored.
- Search is based on the latest loaded business snapshot. Use **Refresh transactions** to refresh contract results; reload the workspace to pull updated snapshot records.

### 16 — Approval Delegation
- **Approval Delegation** sidebar page, including delegation history and effective dates.
- **Only Admin** can create or revoke an approval delegation.
- Supported temporary responsibilities: **Procurement Head**, **Finance Officer**, and **Finance Head**.
- Requires approved, active staff in the appropriate department/role; prevents overlapping delegations for the same responsibility and conflicting Finance approvers.
- Date ranges are evaluated using **Asia/Manila** local calendar days.
- The original requester **cannot approve their own PR**, delegated or not. Finance Head and Finance Officer signoffs remain separate. **The Admin approval step cannot be delegated.**
- Temporary delegates are accepted by the existing secured D1 approval endpoints; each decision records the actual signer.

### 17 — Contract Management
- **Contract Management** page for Procurement and Finance management; suppliers can view contracts for their own company.
- Admin and Procurement Head may create/edit/renew/terminate; Procurement Officer and appointed Finance Officer/Finance Head may view.
- Supplier, contract reference, optional linked Purchase Order, start/end dates, negotiated unit price (PHP), pricing terms, and renewal notice days.
- **Renew** extends an end date and saves previous/new expiry and pricing in an immutable history record.
- **Expiration alerts** appear in the contract page and the existing Notification Bell / Notification Center; online notifications refresh with the existing 30-second polling, not via email/SMS.
- Terminated contracts remain in the historical register and cannot be renewed or edited.

## REQUIRED: Apply the additive Cloudflare D1 migration

**Back up your production D1 data first.** Run these commands from the project's `cloudflare` folder, in order:

```bash
npx wrangler d1 execute procureflowcorp-db --remote --file=migrations/0013_search_delegation_contracts.sql
npx wrangler deploy
```

Then deploy the React frontend using your normal Cloudflare Pages or GitHub Pages deployment process (e.g. `npm run build` from the project root and publish its `dist` directory).

**The cloud migration is required.** Without it, delegation and contract actions will report missing tables rather than saving data. Global Search itself does not require a new database table.

## Verification and scope

- Frontend TypeScript build checks: **passed** (`tsc -b`).
- Cloudflare Worker TypeScript checks: **passed**.
- Migration schema/constraints: **passed SQLite validation**.
- Targeted route tests: **passed** for date-bound delegation, overlap rejection, finance separation, supplier contract scoping, renewals, expiry alerts, and termination.
- Full Vite production bundling could **not** be verified in the provided ZIP's dependencies: it contained Windows Rollup native binaries, not the Linux native binary required in the test environment. Run `npm ci` on your own machine if dependencies need repair.
- Not tested against your live deployed Worker/D1 instance. Changes do not alter the existing meeting or bidding screens.

## Files included

```text
cloudflare/migrations/0013_search_delegation_contracts.sql
cloudflare/src/index.ts
cloudflare/src/financeRoutes.ts
cloudflare/src/delegationRoutes.ts
cloudflare/src/contractRoutes.ts
src/App.tsx
src/components/Header.tsx
src/components/Sidebar.tsx
src/domain/permissions.ts
src/features/notifications/cloudNotificationSync.ts
src/features/notifications/notificationService.ts
src/pages/ApprovalsPage.tsx
src/pages/ApprovalDelegationPage.tsx
src/pages/ContractsPage.tsx
src/pages/GlobalSearchPage.tsx
src/services/contracts.ts
src/services/delegations.ts
src/types/procurement.ts
```

**No `.env`, credentials, local database files, `.git`, `node_modules`, or compiled files are included.**
