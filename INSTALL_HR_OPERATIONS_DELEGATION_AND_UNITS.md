ProcureFlow — Operations / Human Resources Delegation and Measurement Units
CHANGED FILES ONLY (based on the six-issues fix source)

WHAT CHANGED
1. Approval Delegation:
   - Human Resources Head now appears by name when the appointed Head covers the Human Resources department.
   - Admin can see the Human Resources Head option even before someone is appointed. The form explains that the Head must be appointed first; no authority is granted without the appointment.
   - HR delegation continues using the existing Department Head step scoped to Human Resources. This avoids a second incompatible D1 step and preserves the PR approval security rules.
   - Operations Head remains its own delegation responsibility; only an approved Operations Officer from Operations can serve as its substitute. The substitute picker now shows the candidate's actual role.
   - Admin can appoint a Human Resources Head directly from Staff Assignments. HR Head remains a formal appointment, not a new permanent account role.
   - The top-right effective-position label now reflects Human Resources Head / Acting Human Resources Head. Procurement Officer is displayed by its actual job title.
2. Quantity units:
   - The PR unit selector supports units, pcs, kg, cm.
   - Stock Need displays the chosen PR unit and changes the label when a different PR is selected.
   - Unit follows the PR into stock need, PO, deliveries and related views, including invoice verification, amendments, and discrepancies.
   - Older records missing a unit continue to display the legacy default 'units'.
   - This patch retains the existing whole-number quantity rule. Fractional kg/cm quantities would require separate calculations and backend updates.

SECURITY / COMPATIBILITY
- A Human Resources Head is persisted as step_role='Department Head', department='Human Resources'. The secured Worker verifies the Head's appointment, an eligible substitute, the dates, and Admin approval.
- Operations Head is persisted as step_role='Operations Head'; Operations Officer is an eligible substitute, not a separate approval authority.
- Delegations do not confer Admin/Finance permissions, and revocation/expiry still removes temporary access.
- The four measurement unit labels are stored in the existing enterprise-state JSON records; no new columns are introduced.
- The earlier migration 0020_account_retirement_and_operations_delegation.sql must already be applied for Operations Head delegations.

INSTALL
1. Extract this ZIP at your existing ProcureFlow project root, keeping the src/ and cloudflare/ folder paths.
2. From project root run:
      npm run build
3. Redeploy the frontend.
4. From the cloudflare folder run:
      npx wrangler deploy
5. Sign out and sign in again on both the Head and substitute accounts if they still show old cached role badges.

TEST
- Admin > Staff Assignments > Responsibility: choose Human Resources Head; appoint an approved Employee who belongs to Human Resources.
- Admin > Staff Assignments > Operations Officers: appoint an Operations Officer from approved Operations Employees, and ensure an Operations Head is appointed.
- Admin > Approval Delegation: choose Human Resources Head or Operations Head and select the eligible substitute. Test Admin approval and revocation.
- As that Head, create a leave/delegation request and verify it stays Pending until Admin approves it.
- Create a new Purchase Requisition with kg or cm, publish a stock need, submit a bid, issue a PO and log delivery. Confirm the same unit appears at each step.
- Existing requisitions without saved units will show 'units' until changed by an authorized data correction.

VALIDATION
TypeScript checks passed for frontend and Worker; targeted checks confirmed source routing and labels. A production bundle or live D1 test was not completed in this environment.
