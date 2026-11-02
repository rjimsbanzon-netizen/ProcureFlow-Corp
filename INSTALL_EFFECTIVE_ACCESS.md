ProcureFlow — Effective Account Access and Acting Finance Authority
===============================================================

Apply these files to the EXISTING project, keeping folder paths:
  src/domain/effectiveDelegation.ts  [new]
  src/domain/permissions.ts
  src/services/cloud.ts
  src/pages/AccessControlPage.tsx
  src/pages/PaymentsPage.tsx
  src/views/accessControl.ts
  src/views/payments.ts
  src/components/Header.tsx
  cloudflare/src/delegationRoutes.ts
  cloudflare/src/financeRoutes.ts

Changes:
1. The Admin Access Control screen includes a new, server-validated
   'Effective access by account' section, with permanent roles, actual staff
   appointments, active approved substitutions, dates and scoped rights.
2. Employees retain their account role. Delegation grants workflow-scoped
   authority only (not a wholesale administrator/department permission change).
3. A temporarily acting Finance Officer or Finance Head may process payments
   within the same PO-amount threshold as the primary approver, as long as the
   D1 delegation passes all live checks (status, dates, revocation, primary,
   eligibility, separation of duties). A submitted invoice and fully verified
   delivery are still required by the existing payment workflow.
4. The Payments screen checks /finance/payment-authority/:poId for each pending
   payment, instead of using only an assignment label to decide who can act.
5. Temporary authority is refreshed in the UI when logged in and periodically
   (30 seconds through the existing header refresh). The Worker decides every
   protected action independently of that display.

Deployment:
  1) Back up your project / work on a branch.
  2) Merge these files (do not replace your entire repository).
  3) From cloudflare/: npx wrangler deploy
  4) From project root: npm run build
  5) Redeploy the frontend, then sign out/in and refresh the browser.

No database migration is required if you already applied the approval delegation
migrations and your /delegations API works.

Validation run here:
 - Frontend TypeScript: tsc --noEmit PASS.
 - Worker TypeScript: tsc --noEmit PASS.
 - Full Vite bundle not runnable in the isolated copy (vite unavailable).
 - Live Cloudflare D1 credentials not present; authorization behavior has NOT
   been verified against your production account/employee records.

Security notes:
 - Delegation cannot grant Admin privileges, supplier bidding, bidding management,
   or broad Procurement Head permissions.
 - Finance Head and Finance Officer remain distinct sign-offs.
 - Admin is oversight-only for payment processing.
 - Any effective-role display is informational, never a substitute for server
   authorization. Pending, rejected, expired, cancelled, and revoked requests
   confer no rights.
