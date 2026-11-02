# ProcureFlow — Bidding Module Separation

## Install

This ZIP contains changed/new frontend files only. It is built against the latest
Secure Bid Fix + Reschedule Meeting update. Extract it over the `Procurement-System`
project root and allow replacement of existing files. Keep the original other
files; they are required.

## Sidebar modules

Staff with `manage_bidding` permission and the Admin/Procurement Head role:
- Stock Needs & Bidding (`bidding`)
- Bidding Deadlines (`bidding_deadlines`)
- Submitted Vendor Bids & Comparison (`bid_comparison`)
- Supplier Bid Evaluation (`bid_evaluation`)
- Proposal Meetings (`proposal_meetings`)

Suppliers with `submit_bids` permission:
- Stock Needs & Bidding (`bidding`)
- Proposal Meetings (`proposal_meetings`)

## Existing workflows preserved

- Stock need publication, supplier quotation submissions and bid receipts
- Cloud-enforced deadline loading and the secure `/sourcing/bids` workflow
- Comparing offers, selecting suppliers, finalizing agreements and issuing POs
- Bid evaluation scorecards and audit logging
- Meeting invitations, supplier acceptance/decline, overlap warnings,
  cancellation, rescheduling, and meeting history
- Relevant notifications now open their corresponding modules

The original `src/views/bidding.ts` remains a compatibility export.
The visual sections live in focused `src/views/bidding/*.ts` source modules,
with their own `src/pages/*` pages.

## Deploy / checks

Deploy the updated frontend (GitHub Pages or your existing host). No new D1
migration or Worker deployment is required specifically for this refactor.

Targeted checks performed:
- TypeScript/TSX transpilation syntax: passed (16 changed/new files)
- Relative import resolution: passed
- Sidebar permissions and App routes: passed
- Render tests for admin/supplier pages and supplier meeting visibility: passed
- Existing selection/meeting command references: retained

A full production build could not be completed in this environment because
its installed dependency tree was incomplete. Test the complete procurement
workflow in your deployment after copying these files.
