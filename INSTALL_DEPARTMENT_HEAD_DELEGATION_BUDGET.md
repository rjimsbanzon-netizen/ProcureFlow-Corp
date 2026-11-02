# ProcureFlow — Department Head Delegation & Budget Visibility

Apply to the project that already has features 15–17 and the `0014_approver_delegation_requests.sql` migration deployed. **Changed files only**; this archive is NOT a complete system.

## What changes
- Appointed Department Heads may request leave/temporary delegation for **their own department**, selecting an active employee of that department as a substitute. Admin can make the request on the Head's behalf.
- Appointed Heads' requests remain **Pending** until Admin approves, after which substitute authority applies only during the approved dates. The substitute may submit the department's pending PR into the workflow but may **not** approve PRs or edit budgets.
- Existing **Procurement Head → Procurement Officer** delegation stays the same. Existing Finance Officer/Finance Head separation of duties stays the same. Admin's final approval cannot be delegated.
- Department Budgets are visible to the appointed Head for **their department only**. Admin continues to see all departments and retains editing/threshold controls. Procurement Head and Finance Officer keep financial visibility; ordinary employees and suppliers cannot access the budget page.

## Apply the files
1. Back up your project and Cloudflare D1 database. Unzip this archive over your project root, preserving `src/...` and `cloudflare/...` paths. Do not overwrite data/database with a fresh project.
2. From the `cloudflare` folder, after **0013 and 0014 have already been applied**, run the **new migration once**:
   ```bash
   npx wrangler d1 execute procureflowcorp-db --remote --file=migrations/0015_department_head_delegation.sql
   ```
   Note: this migration rebuilds the delegation table to add a department scope. It copies existing delegation records and preserves their IDs, dates, status and review history. Back up D1 first. If your D1 database binding/database name differs, use your actual configuration.
3. Redeploy the Worker from the `cloudflare` folder:
   ```bash
   npx wrangler deploy
   ```
4. Redeploy the frontend, then hard refresh and sign in again. For Department Head accounts, ensure Admin has assigned the **Department Head** responsibility for the matching department under Staff Assignments.

## Test checklist
- Admin: visit Approval Delegation; choose **Operations · Department Head** (or equivalent); choose an active employee from that department; submit on behalf, then verify the delegation record.
- Department Head: log in, submit own delegation request, and verify Admin can approve/reject it. Another Head must not be able to request for Operations.
- Substitute: after approval and during effective dates, can start a pending PR for that department, but cannot approve it; cannot start PRs for other departments.
- Department Head: open **Department Budgets** and see only their department, without Edit controls. Admin sees all and can edit.
- Procurement Head: still only sees active Procurement Officers as eligible substitutes.

## Verification
Frontend and Worker TypeScript checks passed. Targeted SQLite/D1 API tests passed for department delegation and budget visibility. The live Worker/Pages deployment has not been verified here. No data was changed in your live cloud database by preparing this archive.
