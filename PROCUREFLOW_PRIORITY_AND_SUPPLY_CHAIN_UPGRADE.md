# ProcureFlow – Procurement Priority, Purchase Types, and Supply Continuity

Upgrade prepared from **Procurement-System(8).zip**, 2 November 2026. The existing requisition approval, accreditation, bidding, financial approval, payments, document workflow, and receipt-based inventory reconciliation have been retained.

## What is implemented

### 1. Operational priority A / B / C
The **Purchase Requisition** creation form now captures and persists:
- **A – Core / mandatory / critical:** materials that can halt production, mandatory safety or compliance needs, high-impact procurement.
- **B – Regular / important:** predictable operations, planned replacements, recurring support needs.
- **C – Occasional / support:** discretionary or nonurgent one-off purchases.

The requisition register now filters and displays these categories, with legacy records explicitly shown **Not classified**. These are *operational criticality* classes, **not** the standard financial ABC analysis of annual usage value, and **not** government's Approved Budget for the Contract (ABC). They do not bypass approvals or automatically override access control. Examples: a specialized low-cost capacitor needed for production can be A; routinely replaced office desks B; one-off decorative furniture C.

### 2. Eight purchase categories
- **Goods & Materials:** resins, PCB boards, resistors, components, packaging, office supplies.
- **Equipment & Capital Assets:** production equipment, office furniture, test instruments, IT hardware.
- **General Services:** cleaning, repair, hauling, maintenance.
- **Professional & Consulting Services:** engineering, accounting, technical studies, specialist advice.
- **Construction & Works:** civil works, expansion, refurbishment, installation.
- **Software & Digital Services:** cloud hosting, development work, SaaS/software licenses.
- **Rental & Leasing:** leased equipment, vehicles, premises.
- **Utilities & Subscriptions:** telecom, electricity, internet, renewals.

The PR also stores its requested recurrence (`One-time`, `Weekly`, `Monthly`, `Quarterly`, `Annually`, `As-needed under contract`). When a PR becomes a PO through the existing supplier-agreement flow, category, recurrence, and priority are copied into that PO.

For tangible goods and capital assets the existing delivery and inspection flow remains. For other categories the legacy delivery/inspection forms adapt to **work/service completion and acceptance**, but still use the underlying existing workflow, including invoice matching and finance review. **Nonphysical services, leases, works and subscriptions must never be added to the physical goods receipt inventory**; this is enforced during operations inventory synchronization. Construction certification and detailed professional-services milestone approvals would need a later dedicated module.

### 3. Company-bound supplier inventory
New **My Company Inventory** for supplier accounts and **Supplier Stock Directory** for authorized Procurement staff:
- SKU, name, specifications, unit, on-hand quantity, reserved quantity, PHP unit price, lead time, last update.
- Available-to-promise = on-hand - reserved, based on supplier's reported data.
- Updates are stored in D1, keyed by the **registered supplier directory ID** and SKU; not a personal browser account or localStorage.
- Backend determines supplier ID from the authenticated user's `company_name` and the registered supplier directory; it **does not accept a supplier ID in the supplier's inventory mutation**.
- Registered company must match a supplier directory record; the supplier user must have an **Approved** accreditation case to publish stock. Company identity is approved/managed using the existing onboarding controls.
- Every stock edit creates an immutable D1 inventory change entry.

**Important:** the current supplier registration schema links users to companies by approved company name. For stronger tenant isolation in a later production rollout, add an immutable `supplier_company_id` membership table and require an administrator to bind and verify each supplier user against corporate documents. The current approach relies on admins preventing conflicting/misrepresented company names.

### 4. Contract-backed recurring supply plans
New **Recurring Supply & Backup Suppliers** screen for Procurement Head, Admin, and Procurement Officer (read/create according to role):
- Link **an active supplier contract** to a product/service SKU.
- Set **priority**, purchase category, committed/forecast quantity per release, frequency, next release date, and desired safety stock.
- Choose a **primary supplier** and an optional **backup supplier** with an optional **backup contract**. Active accreditation is checked at the server when creating a plan.
- Pause/resume plans; see overdue scheduled releases.
- See early warning where supplier-reported available stock of an exact SKU and unit is lower than the cycle requirement.
- **Scheduled entries are plans, not automatically created POs.** Procurement must open/approve the normal purchase requisition and authorize the PO. Dates are not automatically advanced: this release workflow needs integration with your preferred business rule for order confirmations.

### 5. Shortage incidents and backup sourcing review
- Procurement Officer/Head/Admin logs a confirmed primary supplier shortfall (required amount, confirmed amount and notes).
- The backend calculates the shortage; for tangible materials, it checks exact backup supplier SKU+unit and current **supplier-reported** available quantity.
- **Head/Admin can recommend** a contracted, accredited backup. Recommendation is limited to reported stock or explicitly documented service capacity. It does **not** automatically sign contracts, reserve stock, split POs, transfer funds, or receive goods.
- For service/works shortages, input the backup supplier's confirmed capacity and a real confirmation reference (quote/email/letter), instead of pretending services have warehouse stock.
- Close a case with a reason. A recommendation can later be closed after normal PO/delivery/acceptance work is complete.
- Shortage, plan and stock changes are recorded in additive D1 audit tables.

### 6. Permissions
- **Supplier:** see/edit inventory only for their linked supplier company, with approved accreditation before edits.
- **Procurement Officer:** see supplier directory and recurring plans, report shortage; cannot approve fallback or create/edit plans.
- **Procurement Head / Admin:** create and pause plans, recommend backup, close shortages; regular financial approvals still apply to an ensuing PO.
- **Other staff:** existing requisition rights and document workflow stay as configured; they cannot use the new supply-chain endpoints.

## Setup – run once before using the new features

1. **Back up your production D1 database.** Review the new tables in `cloudflare/migrations/0021_supply_chain_priority.sql`.
2. In PowerShell / terminal, from the project folder:

```powershell
cd cloudflare
npx wrangler d1 execute procureflowcorp-db --remote --file=migrations/0021_supply_chain_priority.sql
npx wrangler deploy
cd ..
npm install
npm run build
```

3. Deploy the built `dist/` to your existing hosting site. Set `VITE_API_BASE_URL` using `.env.example` and your real Worker URL; do not copy or commit secrets. A Workers deployment is not automatically performed by this ZIP.
4. Sign in as Procurement Head/Admin and confirm supplier records, accreditation, active contracts, and company matching before creating a recurring supply plan. Sign in as a Supplier to publish inventory after accreditation is approved. Refresh all sessions after deployment.
5. **Do not run the complete legacy `schema.sql` against production** to apply this feature. Only migration **0021** is new. Apply any older missing migrations in numeric order after review.

### Local/offline demo caveat
The new supplier stock / recurring plans / shortage cases use the **cloud-backed D1 API** and are intentionally unavailable in localStorage-only demo mode. Existing local demo PR priority/category fields work in local state. The migration does not seed demo inventory or fabricate supplier contracts.

## Compatibility / current boundaries

- Existing inventory page is a verified **receipt ledger**. It is **not** a stock-on-hand ledger with consumption or issuance. Its physical receipts are filtered from service completion.
- Supplier stock is **self-reported** and updated manually; no reservations are made merely because Procurement proposes an order. A confirmed PO acceptance/reservation bridge is a separate feature to build.
- Backup recommendations are **not** automatically executed purchase orders. Finance, supplier confirmation, PO amendment/split and legal/contract terms still govern binding orders.
- New A/B/C labels refer to *operational priority*. For a standard value-based inventory ABC report, add historical consumption and unit costs and calculate annual consumption value separately.
- Contracts currently support date/price/terms and renewal history. Contract-backed supply plans are new separate records; the contract PDF has not been changed to enforce a blanket release schedule.
- No notification scheduler, automated PO release, safety stock consumption, service milestone certification, or automatic stock reconciliation between supplier shipment and supplier catalog has been added.
- Legacy UI components/modules may display goods terminology in some screens. Core PR, PO, service acceptance and new supply screens distinguish the new types; broader copy cleanup is a follow-up.
- Existing PWA files are retained unchanged in this upgrade. Test installation independently on deployed HTTPS hosting.

## Philippine law distinction (important)

**Republic Act 12009** (New Government Procurement Act) replaced RA 9184 for Philippine **public procurement**, with transition provisions. It covers government acquisitions of goods, consulting services, and infrastructure projects; the public-law definition of "Goods" can include supporting services. **PF Corp is modeled as a private electronics manufacturer**, so the system's eight-category corporate purchasing taxonomy and A/B/C priority classes are **internal controls**, not mandatory RA 12009 classes. Government procurement planning, eligibility, audit rules, and modes would require a distinct compliance configuration when PF Corp procures on behalf of a public entity. Private PF Corp purchasing should follow applicable private-sector contract, tax, safety, accounting and other rules.

Official references: https://www.gppb.gov.ph/important-update-effectivity-and-transistory-periods-under-ra-12009/ and https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/97750

## Suggested next expansion (not yet implemented)

1. Immutable supplier company IDs / user company memberships with Admin verification and supplier organization roles.
2. Automated PR draft releases, contract release schedule and approval routing, without bypassing finance or binding suppliers automatically.
3. Supplier acknowledgment, partial allocation, PO splits/amendments and stock reservation with idempotent transaction records.
4. Warehouse consumption, safety-stock, reorder points, real value-based ABC analysis, and production BOM/MRP.
5. Specialized milestones, acceptance reports, certification, intangible asset/subscription tracking and service-level penalties.
6. Alert delivery, contract expiry/renewal queues, exception dashboards, supplier OTIF and contingency test drills.

## Verification performed during this update

- Frontend strict TypeScript check: PASS.
- Worker TypeScript compile/type check: PASS.
- SQLite migration compatibility test (0013 -> 0017 -> 0021): PASS.
- Full Vite production bundle: could not be run in this Linux test container because the uploaded `node_modules` tree contains Windows native Rollup and esbuild packages; a clean `npm install` on the deployment machine should install the correct platform packages.
- No production D1 migrations, Worker deployments, live supplier transactions, or browser end-to-end checks have been executed.
