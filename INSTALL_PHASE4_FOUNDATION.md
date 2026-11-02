# ProcureFlow — Phase 4: Foundation for the Future

**Changed files only.** This patch builds on the **Phase 3 Strengthen Modules** update. It does not contain the entire procurement system.

## What is included

1. **Shared procurement types** — `src/types/procurement.ts` now describes typed requisitions, orders, bids, suppliers, deliveries, payments, contract records and invoice records. The older `ProcurementRecord` extension fields remain available while legacy screens are migrated. This is a compile-time contract, not runtime validation.
2. **Store-aware React data hooks** — `src/hooks/useProcurementData.ts` adds `useCurrentUser()`, `useRequisitions()`, `useOrders()`, `useSuppliers()`, and `useDeliveries()`. The hooks subscribe through the existing render bridge; frontend visibility filtering is not a substitute for API authorization. Dashboard, Requisitions and Orders now use these hooks.
3. **Two more React screens** — Supplier Directory and Delivery Monitoring use JSX instead of injected HTML. Existing Add/Rate/View supplier, Inspect and Amend actions remain wired to their original handlers. Supplier delivery views fail closed when an associated supplier profile cannot be resolved.
4. **Permission clarity** — a pure `resolvePermissionRole()` function expresses the existing appointment rules. `PERMISSION_DECISION_TREE.md` documents roles, locked matrix rights and the Worker trust boundary, with targeted tests.
5. **Error boundaries** — a failure in a page or dialog shows a localized retry screen instead of blanking the procurement shell.
6. **Collapsible sidebar groups** — all accessible navigation groups expand/collapse independently; the preference is saved per signed-in account. Existing role-based `canAccessTab()` filtering remains unchanged.

## Install

1. **Back up or commit** your current project.
2. Extract this ZIP into your **project root**, preserving the `src/`, `tests/`, and other relative paths; overwrite only the included files.
3. From the project root run:

```bash
npm install
npm run typecheck
npm run build
```

4. Redeploy **only the frontend** (your Cloudflare Pages build/output). When deploying from GitHub, commit and push the changed files. Hard refresh after deployment; an installed PWA might cache old frontend assets until its service worker updates.

**There are no Cloudflare Worker or D1 schema changes in Phase 4.** Do not run `wrangler deploy` or a D1 migration specifically for this patch.

## Optional tests

With Node.js 22.16+:

```bash
node --experimental-strip-types --test tests/*.test.mjs
```

These targeted tests cover fixed/appointed permission roles, the locked access matrix, and render subscriptions. They are not a replacement for end-to-end testing of login, PR approval, supplier delivery isolation and supplier rating.

## Checks in the provided environment

- Frontend TypeScript (`tsc --noEmit -p tsconfig.app.json`): **PASS**.
- Targeted tests: **11 passed**.
- CSS parse: **PASS**.
- Full `vite build`: **NOT VERIFIED** because the uploaded Windows `node_modules` does not include the Linux native Rollup dependency needed in this environment. Install dependencies on your deployment machine before building.
- Live Cloudflare testing: **NOT PERFORMED**.

## Safe upgrade notes

- The old HTML view helpers have been retained for compatibility while other pages still use them.
- No user roles, approval steps, bidding rules, financial thresholds, or permissions were intentionally changed.
- After replacing the files, smoke-test Admin, Procurement Head, Department Head, Finance, Employee and Supplier accounts. Verify the Delivery and Supplier Directory screens before deploying to production.
