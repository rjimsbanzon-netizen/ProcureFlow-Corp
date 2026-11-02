# ProcureFlow — Procurement Officer appointments in Staff Assignments

## What was missing
Procurement Officer exists as a D1-backed user app_role but the Staff Assignments form only allowed Admin to appoint Department Heads and Finance reviewers. As a result, the Procurement Head delegation screen could legitimately have no eligible officer.

## Included changes
- src/pages/StaffAssignmentsPage.tsx — a dedicated Procurement Officers section with appointment, removal, candidate filtering, and guidance for transferring approved employees into Procurement.
- src/services/finance.ts — secured endpoint calls for appoint/remove.
- cloudflare/src/financeRoutes.ts — Admin-only appointment/remove route, approval, department, role, and conflict checks, with audit evidence. No changes to the Procurement Head → Procurement Officer delegation eligibility rule.

## Installation
1. Copy the files into the same relative project paths, preserving folders.
2. Ensure your prior D1 migrations, including 0016_supplier_analytics_audit_evidence.sql, are already applied; this patch adds **no new migration**.
3. Deploy the Worker from `cloudflare`:
   npx wrangler deploy
4. Build and deploy the frontend from the project root:
   npm run build
5. Refresh the browser. Admin > Staff Assignments > Procurement Officers.

## How to appoint an officer
1. In Admin > User Verification, ensure the account is approved as an Employee.
2. If the employee is in another department, use Staff Assignments > Transfer an employee to another department > Procurement.
3. In Staff Assignments > Procurement Officers select the employee and click Appoint Procurement Officer.
4. The account will then be available in the Procurement Head delegation substitute list (after refresh), subject to all other delegation rules.

## Security and behavior
- Only Admin can call the secured appointment/removal endpoint.
- Appointees must be active, approved, non-revoked Employee accounts assigned to Procurement.
- Existing Head or Finance appointments cannot be silently combined with an officer role.
- Appointment grants the operational Procurement Officer role, not just temporary delegation: the confirmation warns of this.
- Removal returns the account to Employee and ends eligibility for Procurement Head delegation. It does not delete historical records.
- Changes appear in Audit Evidence. Existing active delegations must be reassigned manually if an officer is removed.

## Verification
TypeScript source checks passed for the frontend and Worker. Live database behavior and deployment have not been tested.
