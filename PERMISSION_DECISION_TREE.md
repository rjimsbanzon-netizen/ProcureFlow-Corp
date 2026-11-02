# ProcureFlow authorization decision tree (Phase 4)

This note documents the **existing** role matrix and appointment logic; it does **not** broaden any permission.

1. **Authenticated account?** Otherwise no role or tab access.
2. **Fixed account roles?** `Admin`, `Supplier`, `Procurement Head`, `Procurement Officer` retain their stored roles. The Admin final approval step is not delegable.
3. **Appointed Finance roles?** Only an Employee with a current matching D1 staff assignment and a Finance home department can resolve to `Finance Head` (department Head appointment) or `Finance Officer` (global Finance Officer appointment). A conflicting dual assignment resolves to `Employee`, not either financial role.
4. **Appointed Department Head?** An Employee appointed Head of their **own** department resolves to `Department Head`; another department's appointment does not confer access.
5. **All other accounts:** `Employee`.
6. `hasPermission(action)` applies the locked `fixedValue` constraints first, followed by the editable matrix/defaults. `canAccessTab` checks display/navigation eligibility; it is **not** API authorization.
7. The Worker/D1 must independently enforce approval assignments, delegation effective dates, separation of duties, payment thresholds, supplier ownership, bid deadlines, and account state. Hiding a button or using a hook never authorizes an operation.

## High-risk checks to keep during future migration

- Supplier accounts must never see other suppliers' deliveries, bids, invoices, contracts, or purchase orders.
- Requisition requesters cannot approve their own requests; Department Head submission is a separate action.
- Procurement Head → Procurement Officer is the substitute rule. Department Head cover is limited to the appointed department.
- Delegation must be reviewed/active before substitute authority applies. Never permit circular chains or self-delegation.
- `Finance Head` and `Finance Officer` cannot collapse into one account for approval/payment.
- The editable permission matrix never overrides locked workflow security; the Worker is authoritative.
- Only Admin may edit system-wide budgets, staff appointments, access matrix and the audit review register.

Run the included role-resolution smoke tests with `node --experimental-strip-types --test tests/permissions.test.mjs` on Node 22.16+.
