ProcureFlow — Acting Finance Officer Invoice Matching Fix

Why the Confirm button was missing:
  InvoiceMatchingPage.tsx only recognized the permanent Finance Officer
  assignment in settings.assignments. It ignored active, Admin-approved
  temporary Finance Officer delegations, even though the secured Worker
  matching route already supports them.

Changed files:
  src/pages/InvoiceMatchingPage.tsx
  src/services/finance.ts
  cloudflare/src/financeRoutes.ts

Implementation:
  - GET /finance/settings now includes invoiceVerification.allowed, acting,
    and validUntil, calculated using the same canApproveStep function used
    by POST /finance/invoices/:id/match.
  - The Invoice Matching screen uses this effective authority to display
    the confirm action and the acting-delegation validity date.
  - The Worker continues to revalidate authorization and the three-way
    match when the action is submitted. This patch does not grant Finance
    access to unapproved, revoked, expired or ineligible delegates.

Apply:
  1. Copy these files into the corresponding project folders.
  2. From the project root: npm run build
  3. Redeploy the frontend (Pages/GitHub Pages as configured).
  4. From the cloudflare directory: npx wrangler deploy
  5. Refresh, sign in as Jason, open Invoice & PO Matching,
     select an awaiting invoice using Review checks, and confirm.

No D1 migration required. You need both frontend and Worker deployment.

If the button is still missing:
  - Ensure approval_delegations is Approved/Active, unrevoked, date range
    includes today in Asia/Manila, and Jason is the selected delegate.
  - Ensure Juan remains the current valid D1-appointed Finance Officer
    and Jason is an approved Employee in Finance & Accounting, not also
    serving as Finance Head.
  - Ensure the invoice remains Submitted and has zero matching issues.

Checks performed: frontend TypeScript and Worker TypeScript compile checks.
Not tested against the user's deployed Cloudflare D1 or production build.
