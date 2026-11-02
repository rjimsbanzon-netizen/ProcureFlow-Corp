# ProcureFlow – Executive PR Submission Fix

## Changed files

- `cloudflare/src/financeRoutes.ts`
- `src/pages/ApprovalsPage.tsx`

## What changed

- **Executive PRs:** Admin can start their approval workflow without an Executive Department Head appointment. Executive remains unavailable in Department Head staff assignments.
- **Other departments:** Their existing Department Head appointment and delegation requirements remain enforced.
- **Workflow:** The Executive submission is recorded as a submission marker, not as an approval, then continues through the usual Procurement, Finance (if triggered by amount), and Admin steps.
- **Audit / no self approval:** The actual Admin who submits an Executive PR is recorded as requester. The same Admin cannot later approve their own PR. If the approval policy includes a final Admin step, a different Admin account must perform it.
- **UI:** Explains the Executive exception and displays `Submit as Admin` on eligible Executive requisitions.

## Installation

1. Copy both source files to the matching paths in your current project.
2. From the project root:

   ```powershell
   npm run build
   ```

3. Deploy the frontend to Cloudflare Pages.
4. From the `cloudflare` directory:

   ```powershell
   npx wrangler deploy
   ```

5. Sign out/in or hard-refresh, then open Approval Workflow and submit the pending Executive PR.

No database migration is required.

## Verification

- Frontend TypeScript check passed.
- Worker TypeScript check passed.
- Targeted Worker tests passed: Admin Executive allowed without Head, non-Admin Executive denied, unassigned Operations denied, and existing Admin-on-behalf flow for appointed Operations Head preserved.
- Live D1 / full production build not verified. An Executive PR still requires an appropriate budget before final approval.
