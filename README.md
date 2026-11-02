# ProcureFlow — Admin display name cleanup

Admin users are displayed simply as **Admin** instead of "Procurement Administrator" or "Administrator".

- `src/components/Header.tsx`: primary displayed name is `Admin`; secondary line is the department `Executive`.
- `src/views/users.ts`: User Verification displays `Admin` as the account name and badge.
- `src/domain/staffPositions.ts`: effective Admin position is `Admin` (the account still belongs to Executive).

**Display only:** No account record, username, permissions, registration name, or Cloudflare data changes.

## Install
Copy the three source files into the matching paths of your ProcureFlow project. If you have newer edits in any of these files, merge these targeted display changes instead of overwriting those edits. Run `npm run build`, then publish your frontend.

No D1 migration or Worker deployment is necessary.
