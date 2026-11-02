# ProcureFlow — Advanced Reports, Delivery Discrepancies & Inventory Integration

This project ZIP was assembled from the **Procurement-System(4).zip** archive supplied by the owner. It contains the complete application source, with Features 12–14 already integrated. Do **not** rerun the older `apply_advanced_features.py` installer against this integrated copy.

## What has been added

- **Advanced Reports** (`Advanced Reports` sidebar): paid spend by department; supplier ratings, delivery verification and on-time metrics; PR-to-PO / verified delivery lead times; CSV/PDF export.
- **Delivery Discrepancies** (`Delivery Discrepancies` sidebar): shortages, damaged goods and non-compliant deliveries derived from inspection statuses, with supplier-scoped read-only access, progress notes and resolution history. Resolution requires reinspection to `Completed - Verified`.
- **Inventory Integration** (`Inventory Integration` sidebar): D1-backed receipts for `Completed - Verified` deliveries, net verified quantities, receiving history and correction/reversal movements. This is a record of **verified goods received**, not stock on hand after consumption or issuance.

**Unchanged:** Admin and the assigned Department Head can both initiate Purchase Requisition approvals. Existing approval limits, bidding, supplier messaging, staff assignments, budget management, PO issuance and payment workflows are preserved.

## Important packaging information

The project ZIP intentionally excludes `.git`, `node_modules`, build output and historical backup files to keep the download portable. It retains the supplied project configuration and application assets. When updating an existing Git checkout, **copy the updated files into your existing repository** rather than deleting its `.git` directory.

## Local setup (PowerShell, in the project root)

```powershell
npm ci
npm run build
```

## Remote database migration and Worker deployment

**Back up your Cloudflare D1 database** first. Run the migration **before** the updated Worker is deployed. No existing procurement data is deleted by this migration.

```powershell
cd cloudflare
npm ci
npx wrangler d1 execute procureflowcorp-db --remote --file=migrations/0012_advanced_operations.sql
npm run deploy
cd ..
```

Then publish the updated frontend using your existing GitHub Pages deployment workflow. From your existing Git repository, commit the updated files and push:

```powershell
git add src cloudflare/src cloudflare/migrations/0012_advanced_operations.sql FEATURES_12_14_SETUP.md
git commit -m "Add advanced reports, discrepancy tracking, and verified inventory"
git push origin main
```

If your local Git checkout has other changes, review `git diff` before committing. Do not push secrets or personal database backups to GitHub.

## Check after deployment

1. Admin: **Advanced Reports** → check paid transactions, supplier ratings, lead times, CSV and PDF exports.
2. Procurement: flag a delivery as shortage/damaged/non-compliant; view its **Delivery Discrepancies** entry and add a progress note.
3. Supplier: check that only its own delivery discrepancies can be viewed; the supplier cannot change resolution statuses.
4. Procurement: re-inspect as `Completed - Verified`; check **Inventory Integration** for a received movement. Reinspect as non-compliant to test a reversal.
5. Confirm Admin and the assigned Department Head can still start PR approval as before.

## Caveats

- Production must have the Cloudflare D1 Worker configured, logged-in staff accounts, and migration `0012_advanced_operations.sql` applied.
- Report lead-time metrics require recorded PR/PO/delivery dates. Older delivery records may have an unreliable planned delivery date because earlier code recorded it from the actual date; the updated handler uses the order/PR expected date for **new** records.
- Affected discrepancy quantities are estimates from delivery-level data; individual damaged-unit counts are not currently collected.
- No warehouse issuance, consumption, location, or reorder-point features are added.
- The packaged code passed TypeScript checks and the SQL schema passed a SQLite re-run check. Vite's final bundle could not be run in the Linux test environment because the uploaded `node_modules` contained Windows-specific native dependencies. Run `npm ci && npm run build` on Windows before deploying.
