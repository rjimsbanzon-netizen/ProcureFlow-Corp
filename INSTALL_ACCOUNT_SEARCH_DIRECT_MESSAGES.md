PROCUREFLOW — ACCOUNT, SIDEBAR MODULE SEARCH & DIRECT MESSAGES
===============================================================
FEATURES
- Search the available modules in the left sidebar (including mobile drawer).
- Account section: full name, username, bio, directory visibility and email verification.
- People & Direct Messages: account search, private one-to-one conversations,
  read/unread state and 20-second unread badge refresh in sidebar.
- Registration: Employee / Officer / Head position request for internal accounts.
  Account approval and formal position appointment remain Admin responsibilities.

INSTALL (CHANGED FILES ONLY)
1. BACK UP your project and remote D1 database before continuing.
2. Extract this archive into your project root, preserving folders and replacing
   only matching files. Do not delete the rest of your project.
3. From the cloudflare directory, run the new migration ONCE:
     npx wrangler d1 execute procureflowcorp-db --remote --file=migrations/0018_accounts_profiles_messages.sql
4. For working email delivery, configure Resend with a verified sending domain.
   Use the following commands (each prompts for a value):
     npx wrangler secret put RESEND_API_KEY
     npx wrangler secret put VERIFICATION_FROM_EMAIL
   VERIFICATION_FROM_EMAIL must be an authorized sender, e.g.
   ProcureFlow <notifications@your-verified-domain.example>
   If these are not configured, profile updates and direct messages work,
   but email-code delivery correctly returns a configuration error.
5. Deploy the Worker:
     npx wrangler deploy
6. From the project root:
     npm run build
   Deploy the frontend build output with your normal Cloudflare Pages workflow.
7. Sign out and sign in again (or Ctrl+Shift+R) after deployment.

IMPORTANT ACCESS RULES
- Changing a profile does NOT change assigned roles, departments or permissions.
- Head / Officer / Employee at registration is a REQUESTED position; after account
  verification Admin appoints qualified staff using Staff Assignments.
- Direct messages live in separate D1 tables, not the enterprise-state snapshot.
  Only authenticated sender/recipient can retrieve that chat's messages.
- Directory searches never include email or password, and members can opt out.
- Existing historical usernames are reserved and retained as aliases so old
  requisition/document ownership does not disappear when a username changes.
- Email codes are 6 digits, expire in 10 minutes, and have retry limits.
- Chats refresh by polling (15s); this is not a websocket or end-to-end encrypted messenger.

TESTS RUN
- Frontend: npm run typecheck (passed)
- Worker: TypeScript check including new routes (passed)
- SQLite: 0018 migration, searchable directory, private message storage and
  unread-count queries (passed)
A full production Vite build and live Cloudflare deployment have not been verified.
