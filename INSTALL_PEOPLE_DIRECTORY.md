PROCUREFLOW — PEOPLE DIRECTORY & EMPLOYEE PROFILES
================================================

UPDATE SCOPE
This is an incremental update to the Account / Direct Messages patch.
- Add People Directory under Account & Community (also linked from My Account).
- Search approved, discoverable accounts by name, @username, department,
  official position, or supplier company.
- Open a read-only employee profile with full name, username, department,
  formal position(s), and public bio. For suppliers, show company and public bio.
- View Profile from the Direct Messages chat header.
- Open a private chat from directory results or the profile view.
- Official positions are derived from current Staff Assignments and validated
  account roles, not from unapproved position requests or leave/delegation data.

INSTALL (CHANGED FILES ONLY)
1. Back up your project.
2. Extract this ZIP into your ProcureFlow project root, preserving folders.
3. Deploy your Cloudflare Worker because the directory/profile API is updated:
     cd cloudflare
     npx wrangler deploy
4. Build and deploy your frontend from the project root:
     npm run build
5. Refresh the browser with Ctrl+Shift+R; sign in again if necessary.

DATABASE
- No NEW migration for this patch.
- The existing 0018_accounts_profiles_messages.sql migration from the prior
  Accounts + Direct Messages feature must already be applied.
- Existing Staff Assignments tables are reused.

SECURITY / PRIVACY
- The API responds only for approved, non-revoked accounts whose owner has
  enabled "Show my account in People Search" in My Account.
- Returned profiles omit email addresses, passwords, payroll, leave requests,
  personal documents, and permissions/delegation details.
- A position selected at registration is NOT displayed as an official job
  appointment unless approved and assigned by the existing system.
- The Message action uses the existing secured direct-message routes.

VALIDATION
- Frontend TypeScript check passed.
- Worker account-route TypeScript check passed.
- SQLite directory query checks passed, including position search and privacy.
- API smoke tests passed for formal position display and hidden profiles.
- Full production bundle and live Cloudflare deployment were not tested here.
