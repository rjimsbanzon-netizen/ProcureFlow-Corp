# ProcureFlow — Both-Sided Meeting Rescheduling (Changed Files Only)

## Included changes
- Admin and Procurement Head: **Reschedule** now also appears on eligible **Agreed** meetings, even when a Purchase Order has already been issued. The PO, delivery, and payment records remain unchanged.
- Invited suppliers: **Request Reschedule** on Pending Response, Agreed, or Declined meetings. Supplier proposes date, time, duration, and a required reason; the existing reservation is kept until approved.
- Admin or Procurement Head: **Review Request** offers Approve / Decline. Approving changes the meeting in place (same reference), adds a rescheduling history entry and resets status to **Pending Response** so the supplier confirms again. Declining keeps the original meeting unchanged.
- Pending requests cannot be duplicated, cancelled, or silently superseded by a direct reschedule. Other suppliers cannot request changes or view the invited supplier's meetings.
- Conflict checks run in the browser and again in the cloud Worker when submitting/approving. Optimistic concurrency controls reject stale changes.
- In-app notifications show requests to Procurement and request decisions to the supplier.
- The legacy workspace save endpoint cannot silently overwrite existing meeting dates or request/approval data.

## Install
These files assume you have already applied the previous **Reschedule Meeting** and **Bidding Modules Separation** patches.
Extract into the existing ProcureFlow project, preserving the `Procurement-System/` folder structure and replacing the matching code files.
Redeploy **both** the frontend and the Cloudflare Worker, because the secure endpoints are new:
  POST /sourcing/meetings/:id/reschedule-request
  POST /sourcing/meetings/:id/reschedule-request/decision
No database migration is needed; meeting request data is stored in the existing workspace snapshot.

## Validation
- Eight changed TypeScript/TSX source files transpiled and parsed successfully.
- Simulated D1 route tests passed for own-supplier access, other-supplier denial, pending duplicate prevention, approve/reject, conflict handling, stale request rejection, and keeping the existing PO unchanged.
- Frontend visibility tests passed for supplier request buttons and Procurement review actions.
- Full `npm run build` could not complete because the supplied working node_modules was missing `vite/client`. Live deployment has not been tested.
