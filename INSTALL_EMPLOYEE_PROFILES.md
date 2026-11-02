# ProcureFlow — Employee Profiles Module (Changed Files Only)

## Files

- `src/pages/EmployeeProfilesPage.tsx` — new searchable employee cards, department filter, public profile and Message actions.
- `src/components/EmployeeProfileModal.tsx` — read-only public profile with uploaded avatar, official role(s), department and bio.
- `src/App.tsx` — routes `people_directory` to its own Employee Profiles page instead of combining it with Messages.
- `src/components/Sidebar.tsx` — new Employee Profiles navigation in Account & Community for all signed-in account types.
- `src/services/account.ts` — optional employee-only directory query; retains `emailDeliveryConfigured` for Gmail verification page compatibility.
- `cloudflare/src/accountRoutes.ts` — server-side employee-only directory filter; keeps Gmail API sending and other existing account routes.

## Install

1. Back up the project at `D:\GitHub\Procurement-System`.
2. Extract the ZIP to that project root, preserving the folders. Replace the listed files.
3. From your project root, run `npm run build`, then deploy your built frontend to GitHub Pages as usual.
4. Deploy the Worker because the directory query changed:

   ```powershell
   cd D:\GitHub\Procurement-System\cloudflare
   npx wrangler deploy
   ```

5. Refresh the browser with Ctrl+Shift+R.

## Access and privacy

- **All approved, signed-in ProcureFlow account types** (including Suppliers) may open Employee Profiles.
- Search results include **approved, non-revoked Employee and Admin accounts** with `profile_discoverable=1`; supplier accounts are not returned.
- Personal email addresses, passwords, access rights, leave requests, payroll and documents are **never returned** in public profile API responses.
- The selected official positions are derived from formal staff assignments, not from unapproved signup preferences or delegated permissions.
- Staff control visibility in **My Account → Profile Information → Show my account in People Search**.
- The **Message** button opens the existing People & Messages private chat; it does not send anything automatically.
- Hidden employees remain hidden from new directory searches, but previously established private conversations remain accessible to the participants.
- Self-accounts are excluded from search results (view your own account in My Account).
- Search is limited to 60 results at once; narrowing search terms finds additional people.

## Database

No NEW migration is required **provided** the existing account/profile/direct-messages migrations were applied previously (0018 and 0019). This update uses current tables and fields.

## Verification performed

- Frontend `tsc --noEmit`: passed.
- Cloudflare account routes + Gmail delivery `tsc --noEmit`: passed.
- SQLite execution of the directory SQL: passed for employee-only vs. general directory, private/unapproved/revoked/supplier filtering, position and department search.
- Production browser and live Cloudflare deployment: not run here.

## Integration note

The Worker source file is based on the previously delivered **Gmail API verification integration**. Do not replace it with an older `accountRoutes.ts`, because that would undo Gmail sending and newer profile/messaging features.
