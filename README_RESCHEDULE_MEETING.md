# ProcureFlow — Reschedule Meeting (changed files only)

## New functionality
- Admin / Procurement Head can reschedule existing Pending Response, Agreed, and Declined proposal meetings.
- The Reschedule action is shown in the Proposal Presentation Meetings table.
- Selecting a previously declined meeting in bid review opens the same reschedule form.
- Pre-filled modal allows editing date, time, duration, format, venue, agenda and requires a reason.
- Existing MTG ID and bid relationship are preserved. A rescheduling history is appended.
- Reset invitation status to Pending Response and ask the supplier to confirm again.
- New supplier notification identifies updated meeting invitations, even if the old invite was marked read.
- Protect against conflicts across dates and durations, including server-side validation.
- New authenticated POST /sourcing/meetings/:id/reschedule checks manager role, selected supplier, PO existence, stale revision, overlaps, valid future time and uses a conditional D1 update.
- No schema migration needed. Does not add or delete procurement records.

## Apply
Copy the included files to the corresponding paths under Procurement-System/ in your CURRENT project (preserve the directory structure).
Then rebuild and redeploy the frontend, and redeploy the Cloudflare Worker because the rescheduling endpoint is new.

Example terminal commands (from Procurement-System):
  npm install
  npm run build
  cd cloudflare
  npm install
  npx wrangler deploy

Deploy the newly built frontend using your existing Pages deployment process.
Without the updated Worker, the Reschedule button will receive a 404 API response and changes will NOT save.

## Permissions and behavior
- Only Admin and Procurement Head roles with manage_bidding access can open the form.
- Suppliers cannot directly modify the appointment; they can Agree or Decline the updated invitation.
- Cancelled meetings stay cancelled; use the existing Schedule Meeting flow to make a new invitation.
- Meetings with an already-issued PO cannot be rescheduled.
- Existing meeting overlap warnings on new meeting scheduling are not removed.
- The server interprets meeting dates/times in Asia/Manila (UTC+08:00).

## Validation
- All 8 modified TypeScript files transpile and parse successfully.
- Tested the authenticated Worker route with a simulated D1 state for success, overlap, role restriction, stale revisions, PO issued, past date, touching time intervals, and no-op edit.
- Full production build was not verified due to incomplete npm packages in the available execution environment. No live Cloudflare database test performed.
