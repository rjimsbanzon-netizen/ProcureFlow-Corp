# ProcureFlow — Acting Finance Officer Payment Method UI Fix

## Changed files
- `src/actions/orderActions.ts`
- `src/events/mainEvents.ts`
- `src/domain/permissions.ts`

## Problem
Payment Management may show `Process Payment` based on the Worker's per-PO Finance authority decision. However, opening the payment modal and submitting it also checked `hasPermission('process_payment')`, which can be false for a temporarily delegated Finance Officer whose account is still `Employee`. Consequently, the payment-method selector did not open or the submit was rejected by the browser despite a valid active delegation.

## Changes
- When connected to the cloud, `openProcessPaymentModal` no longer blocks authorized substitutes on the permanent-role check. It verifies with `/finance/payment-authority` and `/finance/match-status` before opening the method/reference form.
- The modal submit no longer blocks active substitutes using the permanent-role matrix. It rechecks these two secured endpoints, then saves the selected `paymentMethod` and `refNumber` to the payment record.
- Finance & Accounting employees can open Payment Management in read-only mode even when their temporary delegation cache is not loaded; only the Worker's authority response allows them to process a PO.
- Offline/demo mode retains the old local role permission check.
- No automatic permissions for Admin, Suppliers, or unrelated roles. Payment authorization remains enforced by the Worker.

## Installation
1. Extract ZIP over project root, preserving `src/` paths.
2. Run `npm run build` in the project root.
3. Redeploy frontend (Cloudflare Pages or your frontend host).
4. Hard-refresh; log in as the active Finance Officer/substitute, open Payment Management, then click Process Payment for an eligible Pending PO.
5. Choose Payment Method and enter Transaction Ref. Confirm and verify it appears under Method & Reference.

No new Worker deployment or D1 migration is required **provided the previously released Finance effective-authorization Worker update is already deployed**.

## Validation
- TypeScript: pass (`tsc --noEmit`).
- Targeted browser-action tests: pass (acting user open+save, server denied, offline local permission unchanged).
- Live Cloudflare D1: not available for testing.

If an older payment already reads `Paid` with missing method/reference, this change does not invent historical payment details. Such records need a separate authenticated, audited correction workflow.
