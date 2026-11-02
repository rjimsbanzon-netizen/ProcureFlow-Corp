# ProcureFlow — native dialogs converted to branded modals

## Source of this package
Merged `ProcureFlow_Updated_System_Improved_Report_Exports.zip` (full project) with the newer `ProcureFlow_PF_Corp_Logo_Advanced_Reports_Fix.zip`. The latter contributes the latest PF Corp report logo and `src/services/reportExports.ts`.

## 20 browser dialogs replaced
- Approval Workflow: Procurement Head / Finance Officer / Admin approval notes and rejection reasons; Finance Head approval and rejection; Admin approval reconciliation.
- Department Budgets: department rename field, rename confirmation, and deletion warning.
- Staff Assignments: replacing/removing Heads, department rename/delete, moving employees, and correcting Procurement Head department.
- Documents: deletion confirmation.
- Supplier Accreditation: removal of submitted documents.
- Restore Missing Record: record restore confirmation.
- Reset Workspace: typed `RESET` validation.
- Purchase Orders: supplier acceptance and signature.
- User Administration: revoke access and permanently delete account.

All now use a consistent, accessible ProcureFlow modal (forest green overlay, warm-paper panel, copper action buttons, red destructive-action styling), with explicit Cancel and close buttons, Escape, keyboard focus management, and inline validation for required reasons/typed confirmation. Existing API calls and authorization rules are retained.

## Integration
- `src/services/actionDialogs.ts` exposes `confirmAction(...)` and `requestInput(...)` as promise-based functions, callable from React components or existing DOM event handlers.
- `src/components/ActionDialogHost.tsx` is mounted globally by `src/App.tsx`, so page navigation does not require duplicating the modal.
- Existing confirmation logic now uses `await` for the user's result before performing the original action.

## Notes
- No database migrations or Worker API changes are needed for the modal upgrade.
- Test the full user flows in your deployment after installing dependencies (`npm ci`, `npm run build`), especially approval, Department settings, User Management, supplier PO acceptance and Admin reset.
