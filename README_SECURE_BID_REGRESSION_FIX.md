# ProcureFlow secure bid submission regression fix

## Why the error occurred

A later UI update restored the old `src/events/mainEvents.ts` bid submit handler. It inserted a new bid into the local `DB.bids` array, then called `Storage.save(DB)`, which PUT the new bid through `/enterprise-state`. The Worker correctly blocks new bids through that endpoint so it can enforce accreditation and bid deadlines.

This error does **not** prove that the supplier accreditation was rejected. The correct endpoint `/sourcing/bids` performs the actual accreditation and deadline checks.

## Changed file

- `src/events/mainEvents.ts`

## Fix

- The bid form submits via the existing authenticated `POST /sourcing/bids` service.
- Before submission, existing bids are checked against the actual cloud snapshot, not only the browser's potentially stale optimistic data.
- The success message is displayed only after the server returns a confirmed bid.
- The server-generated bid ID is retained.
- The local cache is updated from a confirmed server snapshot without triggering another `/enterprise-state` save.
- Errors are shown as failed submission; no local bid is created on rejection.
- Older queued cloud-save failures caused solely by the legacy new-bid path do not prevent a secure retry.

## Installation

1. Copy the `src/events/mainEvents.ts` file into the matching location in the existing project.
2. From the project root: `npm run build`.
3. Redeploy the frontend to Cloudflare Pages or your static host.
4. Refresh the page using Ctrl + Shift + R. If running the installed PWA, reload it so it picks up the new frontend assets.
5. Sign in and check the bid record against the shared cloud system before resubmitting. If the server has an existing bid, this update reports it as already saved instead of submitting a duplicate.

No database migration or Worker deployment is required by this frontend-only patch. Do not remove the `/sourcing/bids` accreditation and deadline checks.

## Checks

`npm run typecheck` passed against the available project copy. Full build and live API behavior have not been verified here.
