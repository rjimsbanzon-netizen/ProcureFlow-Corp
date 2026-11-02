# ProcureFlow — Executive Department Head dropdown filter

This patch changes only the Staff Assignments > Assign one Head per department form.

Changed files:
- src/pages/StaffAssignmentsPage.tsx
- cloudflare/src/financeRoutes.ts

What changed:
- Executive does not appear in the Department dropdown when assigning a Department Head.
- The frontend blocks submission with Executive as the selected Head department, including stale values.
- The Worker rejects new Executive Department Head assignments even if called outside the UI.
- Existing Executive employee accounts, department records, transfers, and procurement history are untouched.
- An existing Executive Head appointment, if any, is not automatically deleted.

Installation:
1. Extract these two source files into the matching folders of your project.
2. From your project root: npm run build
3. Redeploy your frontend (Pages).
4. From your cloudflare folder: npx wrangler deploy
5. Hard-refresh your browser (Ctrl+Shift+R).

No D1 migration is needed.

Validation: frontend and Worker TypeScript checks passed on the available project copy. Live deployment not verified.
