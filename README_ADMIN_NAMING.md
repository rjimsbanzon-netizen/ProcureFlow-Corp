# ProcureFlow — Admin Naming Update

This patch changes remaining visible role references such as “Administrator”, “administrators”, and the example “System Administrator” to **Admin** in the frontend and API responses.

All authorization logic, the internal `Admin` role identifier, and backend routes remain unchanged. No database migration is needed. The SQL file in this patch only changes a comment; it does not alter the schema.

## Installation

1. Back up your project.
2. Copy the `src/` and `cloudflare/src/` files in this ZIP over the matching paths in your current project.
3. You may skip `src/db/schema.sql` if your database schema has custom edits; the only change there is a comment. **Do not re-run the full schema migration** for this patch.
4. Rebuild/redeploy the frontend and Worker for both UI and server error strings to update.
5. Existing account display names in the live database are not renamed automatically. Admin users already display as “Admin” in the application header.

## Validation

- Frontend: `tsc --noEmit -p tsconfig.app.json` passed.
- Worker: targeted TypeScript check passed.
- No new database fields or endpoints were introduced.
