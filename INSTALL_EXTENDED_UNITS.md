# ProcureFlow — Expanded Units of Measurement

This is a **changed-files-only** frontend patch, based on the latest Operations Delegation + Requisition Units modal update.

## What's included

- 53 common procurement units organized into 7 dropdown categories:
  - Count & quantity: units, pieces, sets, pairs, dozens, lots
  - Packaging & supplies: packs, boxes, cartons, cases, bundles, reams, rolls, sheets, bags, sacks, bottles, cans, jars, tubes, vials, trays, pallets
  - Weight / mass: mg, g, kg, t, oz, lb
  - Length: mm, cm, m, km, in, ft, yd
  - Area: cm², m², ft², hectares
  - Volume: mL, L, gallons, cm³, m³
  - Time & services: hours, days, weeks, months, years, services, licenses, subscriptions
- Shared unit definitions for both the React New Purchase Requisition modal and the legacy HTML form.
- Legacy form validation now accepts every catalog entry, instead of only units/pcs/kg/cm.
- Existing records retain their stored unit code. Stock Needs, Orders, and Deliveries keep inheriting units from requisitions.
- Generated requisition/order PDFs and tracking summaries show the saved unit, instead of only a bare number or a hardcoded 'units' label.

## Installation

1. Extract the ZIP into the ProcureFlow project root, preserving its `src/` folder structure.
2. Replace existing files when prompted.
3. From the project root, run `npm run build`.
4. Redeploy the **frontend** to Cloudflare Pages, then hard refresh your browser.

**No D1 migration or Wrangler Worker deployment is necessary** for this dropdown catalog update.

## Important quantity limitation

The procurement system currently enforces **whole-number quantities** at multiple stages, including approvals, Purchase Orders, deliveries, and inventory accounting. This patch adds unit *types*, not decimal/fractional quantity support. For example, enter 2 kg rather than 2.5 kg; alternatively, use 2500 g where appropriate. Adding fractional quantities would require a coordinated migration of order, inspection, bid, and finance validation, so it is intentionally not changed here.

## Verification

- Frontend TypeScript check completed successfully against the available source copy.
- Unit catalog validation verified **53 unique unit codes**, 7 groups, legacy defaults, and HTML-option parity.
- Live deployed workflows were not tested.
