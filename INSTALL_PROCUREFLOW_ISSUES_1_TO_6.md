ProcureFlow — Six Issues Investigation & Fix
===========================================
Baseline: the latest locally available ProcureFlow project with Accounts, People & Messages,
profile photos, notifications, Staff Assignments and secure sourcing endpoints.

Copy the src/ and cloudflare/ directories from this ZIP into your project. Preserve folder names.
Only changed source files and migration 0020 are included, not a full project.

Fixes
-----
1. APPROVED ACCOUNT REMOVAL
   Admin's Remove Account now RETIRES the account in D1, rather than hard-deleting rows
   referenced by invoices, requisitions, approval history, messages and other records.
   It revokes active sessions/delegations and removes formal staff assignments.
   Removed accounts disappear from User Verification, but historical records are retained
   for audit integrity. Usernames remain reserved; this is not personal-data erasure.
   Admin's own account remains protected.

2. OPERATIONS DELEGATION AND LIVE ROLE DISPLAY
   - Staff Assignments has Operations Head and Operations Officer choices.
   - Operations Head uses the existing Operations Department Head appointment.
   - Operations Officer is a formally appointed role for approved Operations employees.
   - Operations Head can request an Operations Officer substitute during absence;
     an approved substitution covers Operations Purchase Requisition submission ONLY.
   - The server continues to validate active staff, appointment, expiry and Admin decisions.
   - Current account role and position label refresh while the site is running, with a
     focus/visibility refresh plus a five-second poll of the authenticated account role.

3. QUANTITY UNITS
   New Purchase Requisitions offer units / pcs / kg / cm. The selected unit is carried
   into the Stock Need, Purchase Order and Delivery record, and displayed on detail screens.
   Old records default to "units". Quantities are whole-number values in this patch;
   fractional kg/cm would require a separate end-to-end quantity calculation revision.

4. EMPLOYEE TRANSFER
   Shows all approved staff in the transfer dropdown. Officers or employees with active
   Head/Finance appointments appear but are disabled with a reason rather than disappearing.
   To transfer one, remove their appointment or return their job role to Employee first.
   The secured Worker continues to reject unauthorized transfers and protect pending work.

5. SUBMITTED BIDS / COMPARISON
   Adds authenticated GET /sourcing/bids. Admin and Procurement Head receive all D1-saved
   submitted bids; Supplier accounts can see only their own bids. The Comparison page
   refreshes every 15 seconds, on tab focus, or with the Refresh bids button.
   Supplier submission still uses secured POST /sourcing/bids and accreditation/deadline
   checks remain intact. A bid rejected by the server will NOT appear as confirmed.

6. USER VERIFICATION SEARCH
   The account verification page now searches name, username, email, department,
   account status and official position. Empty results have a clear message.

Deploy
------
1. BACK UP D1 before applying migration 0020.
2. From the cloudflare directory run ONCE:
   npx wrangler d1 execute procureflowcorp-db --remote --file=migrations/0020_account_retirement_and_operations_delegation.sql
3. Deploy the Worker:
   npx wrangler deploy
4. From the frontend project root run:
   npm install
   npm run build
5. Deploy the updated frontend to Cloudflare Pages (or your existing hosting).
6. Sign out/in and hard refresh if a PWA service worker still serves old files.

Migration order requirement: 0013, 0014, 0015 and 0019 must have already run,
along with the intermediate migrations for your previously installed features.
Do not re-run applied migrations without reconciling D1 schema first.

Verification performed here
---------------------------
- Frontend TypeScript: passed.
- Worker TypeScript: passed.
- SQLite simulated migration sequence 0013 -> 0014 -> 0015 -> 0020: passed,
  preserving old delegation rows and accepting Operations Head delegation.
- SQLite simulated approved-account retirement retained a historical FK reference.
- No access to live D1 records or live deployment; run smoke checks in staging.

Recommended post-deployment smoke checks
----------------------------------------
- Admin removes an approved TEST account with historical PR links; it disappears from
  User Verification, while related audit/PR records remain and its sessions stop working.
- Admin appoints Operations Head (Operations department) and Operations Officer;
  the Head requests coverage, Admin approves, substitute can submit Operations PR only.
- Confirm current role label changes on the employee's account while logged in.
- Create a PR for 5 kg or 3 pcs; publish the need and issue a PO; confirm unit labels.
- Open employee-transfer picker and inspect enabled/disabled staff explanations.
- Approved supplier submits a bid; Procurement Head opens Bid Comparison and refreshes;
  verify the bid appears. Pending/rejected accreditation still blocks POST.
- Verify User Verification search filters accounts without changing role assignments.
