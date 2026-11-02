# ProcureFlow — Approval Delegation & Leave-Related Coverage Requests

**Changed files only**. Built on `Procurement-System(5).zip` plus the previously supplied Features 15–17 patch.
Extract into your existing project root, preserving directory structure.

## What changed

- A currently appointed **Procurement Head, Finance Officer, or Finance Head** can open **Approval Delegation** and submit their own leave-related coverage/delegation request with a proposed substitute, dates, and reason.
- Self-submitted requests start as **Pending**, with **no approval authority granted** until Admin approves them.
- **Admin** may submit and authorize a delegation **on behalf of the actual appointed approver**, including when that approver is unable to access their account. Admin's action, the original approver, and substitute are recorded separately.
- Admin can approve/reject pending requests; rejections require a reason. Approvers and Admin can cancel pending requests or revoke approved coverage. A substitute can read their own delegations but **cannot submit or authorize a request for the primary approver**.
- Admin receives a notification for new pending requests; the original approver receives approval/rejection notifications; substitutes receive appointment notifications (existing Notification Bell polling).
- Existing approved Admin-created delegations remain valid. The **Admin's own final PR approval step is not delegable**. A Department Head's *submission* of a PR is not itself an approval step, so this module does not delegate it.
- Only appointed approver accounts can self-submit. Admin is the sole user who can submit on behalf of another approver; ordinary employees and suppliers cannot impersonate someone else's role.
- All approval decisions still use the server's existing requisition-step checks, required effective dates, request-owner check, and Finance separation of duties. A pending or rejected delegation never grants signing rights.
- A leave-related delegation request tracks *coverage of approval work*. This module does **not** approve HR leave or manage payroll leave balances.

## REQUIRED: Additive D1 migration (run once)

First, ensure the prior `0013_search_delegation_contracts.sql` migration from Features 15–17 was applied. **Back up the D1 database before applying migrations.**

From your project's `cloudflare` directory:

```bash
npx wrangler d1 execute procureflowcorp-db --remote --file=migrations/0014_approver_delegation_requests.sql
npx wrangler deploy
```

Then rebuild/redeploy the frontend using your current process.

The new migration adds `request_kind`, `review_status`, `reviewed_by`, `reviewed_at`, and `review_note` to the existing `approval_delegations` table. Existing rows default to Approved and are not deleted.

## Files in this ZIP

```
cloudflare/migrations/0014_approver_delegation_requests.sql
cloudflare/src/delegationRoutes.ts
src/pages/ApprovalDelegationPage.tsx
src/services/delegations.ts
src/features/notifications/cloudNotificationSync.ts
src/features/notifications/notificationService.ts
README_APPROVAL_DELEGATION.md
```

## Tests and limitations

- Frontend TypeScript check (`tsc -b`): passed.
- Cloudflare Worker TypeScript check (`tsc --noEmit`): passed.
- In-memory SQLite + actual route integration assertions: **38 passed**, including self-submission, Admin-on-behalf, reject/approve/cancel/revoke, finance separation, and approved-only signing.
- A complete production Vite bundle and live D1 deployment were **not** verified here.
- This patch does not modify supplier accreditation, bids, contracts, meeting schedules, finance thresholds, or existing PR approval sequence.
