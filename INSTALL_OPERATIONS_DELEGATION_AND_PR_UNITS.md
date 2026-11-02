ProcureFlow — Operations Delegation Dropdown + Requisition Units
===============================================================

Changed files (copy while preserving paths):
  src/components/RequisitionFormModal.tsx
  src/pages/ApprovalDelegationPage.tsx
  cloudflare/src/delegationRoutes.ts

Fix 1 — Dashboard "New Purchase Requisition" modal:
  - Quantity now has a Unit of Measurement selector: Units, Pieces (pcs), Kilograms (kg), Centimeters (cm).
  - The selected unit is saved in the requisition's unit field and reused if a local pending PR is edited.
  - Quantities are still whole numbers; decimal kg/cm quantities would require a separate change.

Fix 2 — Approval Delegation Operations selection:
  - Admin always sees "Operations Head → Operations Officer" under Approval responsibility,
    including when an Operations Head has not been appointed or the Worker is outdated.
  - An approved, appointed Operations Head may request a substitute; Admin can also submit on the Head's behalf.
  - An approved Operations Officer appears under Authorized substitute *after* an Operations Head is selected, provided the officer belongs to Operations and meets the secure eligibility rules.
  - Operations Officer is a substitute for this responsibility, not a separate sign-off or an Admin role.
  - The page now explains vacant appointments and an outdated Worker instead of silently hiding the role.
  - The Worker also recognizes a legacy explicit Operations Head app_role only when the account has a real department Head appointment.

IMPORTANT BEFORE DEPLOYMENT:
  The previous 0020_account_retirement_and_operations_delegation.sql migration is required for the database to accept Operations Head delegation records. If it has already been applied, DO NOT run it twice. If it has not been applied, first back up D1 and apply it:
    cd cloudflare
    npx wrangler d1 execute procureflowcorp-db --remote --file=migrations/0020_account_retirement_and_operations_delegation.sql

Deployment:
  1. Copy the three files to your project with matching folder paths.
  2. From project root: npm run build
  3. Redeploy the updated frontend.
  4. From cloudflare/: npx wrangler deploy
  5. Sign out/in or hard-refresh to load the latest interface.

To set up Operations delegation in the UI:
  Admin > Staff Assignments > Appoint Operations Head (an approved Operations employee).
  Admin > Staff Assignments > Operations Officers > Appoint Operations Officer (another approved Operations employee).
  Admin > Approval Delegation > Approval responsibility > Operations Head → Operations Officer.
  Authorized substitute > the appointed Operations Officer.

Notes:
  No new D1 migration is shipped in this small patch. It relies on the previous Operations delegation migration 0020 being applied.
  Frontend and Worker TypeScript checks passed; not tested against your live D1 data.
