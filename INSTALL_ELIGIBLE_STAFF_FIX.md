# ProcureFlow — Eligible Staff Fix for Approval Delegation

This patch only changes delegation candidate selection and the empty-roster explanation.
It does not change which roles can delegate or bypass approval security.

## Included files
- `src/pages/ApprovalDelegationPage.tsx`
- `src/services/delegations.ts`
- `cloudflare/src/delegationRoutes.ts`

## Installation
1. Make a backup/commit of your current code.
2. Copy the three files into the matching folders of your ProcureFlow project.
3. From project root, run `npm run build` and deploy the frontend.
4. From `cloudflare/`, run `npx wrangler deploy` to deploy the new candidate response.
5. Hard refresh in your browser and open Approval Delegation.

No D1 migration is needed.

## How eligibility works
- Procurement Head: a separate, approved, active `Procurement Officer` account whose department is `Procurement`.
- Department Head: a separate, approved, active `Employee` in the Head's same department; only PR submission coverage is granted.
- Finance Officer / Finance Head: an approved, active `Employee` belonging to Finance & Accounting, subject to Finance separation-of-duties checks.
- The primary approver cannot appoint themselves. The authorized Admin review workflow remains unchanged.

If there is no employee matching these criteria, the dropdown correctly remains empty.
Admin should check **User Verification** to approve/set the intended role and **Staff Assignments** to correct department membership.

## Validation performed
- Frontend TypeScript typecheck passed.
- Worker TypeScript check passed.
- Targeted static checks for server-side candidate filtering and Admin navigation passed.
- Live D1 account records are not accessible here, so existing staff eligibility in your production database cannot be verified.
