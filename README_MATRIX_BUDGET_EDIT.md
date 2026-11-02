# ProcureFlow — Edit Department Allocations & Simplified Access Matrix

This patch was prepared against the latest Access Control / Finance Threshold workspace. It includes **only two modified frontend files**, preserving the rest of your project.

## Changed files

- `src/pages/BudgetsPage.tsx`
  - Admin can choose **Edit allocation** on any department budget card.
  - Existing allocated, committed, spent, and remaining amounts remain visible.
  - Changes are saved through the existing `/finance/budgets` API and checked against committed + spent amounts.
  - Errors stay visible in the inline editor; changes are confirmed only after a successful save and refresh.
  - The original allocation form and approval-threshold settings remain in place.
  - Non-Admin users can view budgets but cannot edit them.

- `src/views/accessControl.ts`
  - Displays **only configurable permissions**, not workflow-only rows.
  - Shows checkboxes only for role/permission combinations Admin can edit.
  - Ineligible combinations are represented by a dash, not a locked or disabled checkbox.
  - Existing Save Permissions command and matrix synchronization are unchanged.
  - Protected actions such as account administration, stage-based approvals, Finance payment authorities, and signed-document verification remain governed by server-side rules.

## Install

Back up your current files, then copy both files into the same paths in `D:\GitHub\Procurement-System`.

```powershell
cd D:\GitHub\Procurement-System
npm run build
```

After the build succeeds, publish the frontend through your existing GitHub Pages workflow. **No database migration or Worker deployment is required.**

## Important

The matrix only controls previously configurable rights; it cannot override protections for login, department assignments, financial thresholds, payment matching, or supplier-specific document access.

Test as Admin: change a budget allocation and refresh; then toggle a configurable permission, save, and refresh. Check that both persist. Confirm that a non-Admin sees no budget edit button.

## Validation

The changed files passed TypeScript checking with the pre-existing `noUnusedLocals` warning disabled. The complete project still reports an unrelated unused `React` import in `src/main.tsx` when the stock TypeScript config is used. The editable matrix passed focused rendering and normalization checks. Live deployment was not performed.
