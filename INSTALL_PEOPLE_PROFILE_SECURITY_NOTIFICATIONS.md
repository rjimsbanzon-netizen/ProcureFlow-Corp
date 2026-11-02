# ProcureFlow — People & Messages / Account Security / Private Message Alerts

## Changed files only

This patch builds on the Account + Direct Messages update (migration 0018) and the People Directory update.

### Changes
- One **People & Messages** screen for account search, read-only employee profiles and 1:1 chats. The former `people_directory` route continues to open the combined screen for compatibility, but is no longer a separate navigation entry. The old `src/pages/PeopleDirectoryPage.tsx` can be deleted; it is no longer imported.
- My Account: Change Password (requires current password) and Upload/Remove Profile Picture.
- Photos are resized to 192×192 on the client, validated on the server (raster JPEG/PNG/WebP only, 60 KiB maximum), and displayed on profile cards, in private chat, and in the top-right account menu. The file is stored as a small base64 data URI in D1 (no R2 setup necessary). The directory only shows photos for approved, discoverable accounts.
- New password: minimum 10 characters, wrong-password throttling (5 failures / 15 min), PBKDF2 hashing via the existing Worker helper, and termination of the account's other sessions after success. This does not change their roles or procurement permissions.
- Notification bell, Notification Center and sidebar alerts now count recipient-only **New private message** events. Clicking one opens the sender's conversation. Reading the conversation clears its unread alerts. Polling refreshes while the app is running; this is not remote push when the app is closed.

## Install
1. Back up your D1 database.
2. Merge these files over the matching paths in your current project; keep the folder structure. Don't overwrite unlisted files.
3. If you have NOT already run migration 0018, run it first. Then **from the cloudflare folder**:

   npx wrangler d1 execute procureflowcorp-db --remote --file=migrations/0019_profile_avatar_password_security.sql

4. Deploy your Worker from the cloudflare folder:

   npx wrangler deploy

5. Build the frontend from the project root and publish the built frontend to your existing hosting service:

   npm run build

6. Refresh the web page / PWA. Sign in and check My Account > Profile picture and Change password; test private chat notifications between two approved accounts.

## Checks and caveats
- Frontend and Worker TypeScript checks passed; SQLite migration smoke test passed.
- A complete production Vite build and live D1/Resend deployment were not exercised here.
- This uses **migration 0019**, which assumes the earlier account tables in **0018** already exist.
- Photos are publicly viewable to authorized account-directory viewers as part of the profile; use the existing directory visibility setting to hide the account from people search.
- Password change signs out other active sessions, but leaves the current session signed in. Rate limiting is per account, not per IP.
