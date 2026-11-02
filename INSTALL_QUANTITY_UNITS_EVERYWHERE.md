ProcureFlow — Selected Quantity Units Everywhere
==================================================

Use this patch after the 53-unit and searchable-unit updates. It contains only the
quantity display and inventory API files, not the full project.

What changed
------------
* A single display formatter renders a value together with its selected unit.
* The Dashboard's Recent Requisitions table shows e.g. 400 kg, 20 pcs.
* Requisitions, orders, delivery and inspection, invoice matching, bidding,
  amendments, tracking, and PDF quantity fields use the same unit.
* React New Requisition and older HTML requisition forms show the current
  unit next to Quantity and the estimated price field.
* The D1 inventory GET endpoint exposes units derived from the linked
  delivery/PO and separates inventory aggregates by unit, preventing sums
  of unlike quantities. No D1 schema changes are required.
* Inventory history CSV includes the measurement unit.

Installation
------------
1. Extract the ZIP into your project root, preserving paths (replace files).
2. From the project root run: npm run build
3. Redeploy the built frontend (Cloudflare Pages or your hosting setup).
4. From the cloudflare folder run: npx wrangler deploy
5. Hard-refresh the app and verify quantities on your own real records.

Compatibility and limits
------------------------
* Requires existing searchable-measurement-unit component from previous patch:
  src/components/SearchableMeasurementUnit.tsx
* Older records created without a saved unit show 'units' as a fallback.
  This patch does NOT guess or change historical quantities or units.
* Quantities remain whole numbers under existing approval/delivery rules.
* The patch does not alter approval, security, or payment permissions.
* Frontend and isolated Worker TypeScript checks passed; live Cloudflare
  deployment and real database behavior were not tested.
