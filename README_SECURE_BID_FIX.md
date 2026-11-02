# ProcureFlow – Secure Supplier Bid Submission Fix

## Root cause
The Supplier bid form wrote its new bid to the shared enterprise snapshot via Storage.save(DB),
which sends PUT /enterprise-state. The Worker intentionally rejects newly inserted bid records
from that endpoint, requiring POST /sourcing/bids for server-side supplier accreditation
and deadline enforcement. This is NOT evidence that an approved supplier lost accreditation.

## Changes
- Supplier bid form now awaits POST /sourcing/bids with the quotation payload.
- The server creates and returns the canonical bid ID and records its own audit trail.
- A bid is displayed as successful only after server confirmation.
- The frontend stops submitting locally generated BID IDs through PUT /enterprise-state.
- The submit button is disabled during the request to reduce accidental duplicates.
- Error responses from the secure endpoint are shown without misleading success messages.
- Previously queued snapshot saves are drained before the secure POST.
- After success, the frontend updates its in-memory bid and refreshes the cloud snapshot
  when available, without treating a failed follow-up GET as a failed bid submission.

## How to deploy
1. Extract the full ZIP and rebuild / redeploy the frontend with your existing commands.
   Or copy the changed src/events/mainEvents.ts into your current project.
2. Hard-refresh the portal (Ctrl+Shift+R), sign out/in if needed, and submit the bid again.
3. Verify a successful POST /sourcing/bids in the browser Network panel, and check the
   Bid list after a second refresh. A 201 response indicates the Worker accepted the bid.
4. No schema migration or Worker code change is required for this particular issue if
   the existing /sourcing/bids route is already deployed.

## Important
Backend accreditation, deadline, and duplicate-bid checks remain enabled. If a new
endpoint error says 'Accreditation required', check the current logged-in supplier's
backend accreditation record and validity dates. A previously shown client-side bid
may never have been saved; refresh the portal to load server-confirmed bids.

## Validation performed
- Confirmed that the old handler used local DB.bids.unshift + Storage.save(DB).
- Confirmed that the Worker rejects new bids through /enterprise-state and provides
  POST /sourcing/bids.
- Confirmed TypeScript transpilation of the updated mainEvents.ts with zero diagnostics.
- No live deployment or authenticated end-to-end D1 test was performed.
