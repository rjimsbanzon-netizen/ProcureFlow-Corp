# ProcureFlow — Module visibility regression repair

## Confirmed regression
The earlier `ProcureFlow_Updated_Access_Matrix_Finance_Threshold_Payment_Fix.zip` included a full replacement `src/domain/permissions.ts` that **omitted these module cases**:

- `supplier_messages` — Supplier Messaging
- `accreditation` — Supplier Accreditation
- `staff_assignments` — Staff Assignments (added by a separate Admin module integration)

`Sidebar.tsx` filters every menu entry through `canAccessTab()`. Without the cases, all three return `false` and disappear, even though their pages, messages, and other data may still exist.

The **later** `ProcureFlow_Editable_Budgets_Simplified_Access_Matrix_Fix.zip` contains only `BudgetsPage.tsx` and `views/accessControl.ts`; it **does not delete message or accreditation code**. It deliberately hides *workflow-only rows* from the editable Access Control Matrix, including the non-editable Supplier Messaging row. Those rows should not be confused with the app modules.

## Safe fix
Copy `scripts/restore-hidden-modules.mjs` into your project's `scripts/` directory. Run **from the project root**, not `cloudflare`:

```powershell
cd D:\GitHub\Procurement-System
node scripts/restore-hidden-modules.mjs --check
node scripts/restore-hidden-modules.mjs --apply
npm run build
```

The script makes a timestamped backup and only inserts the missing cases into your **existing** `src/domain/permissions.ts`. It does not replace your newer access matrix, Finance rules, invoice modules, Worker, or message history. Running it twice does not duplicate cases. It also checks that the app routes, sidebar entries, pages and sourcing API integration exist. **Review warnings before deploying**; if page or API files are missing, the permission patch alone is not enough.

Once the frontend builds, publish it through your usual website deployment process. **No database reset or migration is required for this permission fix.**

## Expected access
- Supplier Messaging: Supplier (own conversations), Admin, Procurement Head, Procurement Officer; existing transaction-level API authorization still applies.
- Supplier Accreditation: Supplier (own documents), Admin, Procurement Head; existing reviewer/document checks still apply.
- Staff Assignments: Admin only.

Bidding deadlines are inside Bidding & Proposals, not a separate navigation entry. The fix does not alter bidding deadlines, notifications, payment thresholds or any user records.

## Security note
Restoring a *tab visibility rule* does not by itself grant backend access. The underlying API must still enforce authorization. Do not replace the whole Worker with an older file to fix a missing menu item.
