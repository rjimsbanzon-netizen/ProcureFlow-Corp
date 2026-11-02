# ProcureFlow — selectable private-business demo companies

**This is a fictional procurement training workspace.** It is NOT a government procurement portal or real supplier-accreditation service. The company names, contacts, prices, quantities, bids, documents and payments are demonstration data, not real commercial/legal facts.

## Included training companies

| Preset | Company | Departments | Logins (Heads + Officers + suppliers) | Example priority A material |
| --- | --- | ---: | ---: | --- |
| Electronics shop & repair | ElectroLab Electronics Shop | 9 | 26 | ESP32 boards, regulators, relays, microcontrollers |
| Bakery / food production | Golden Crust Bakery | 10 | 28 | Flour, dairy, eggs, chocolate, fruit and sanitation |
| Cellphone repair center | FixPoint Mobile Repair Center | 10 | 28 | Batteries, displays, camera/charging modules and tools |
| Construction services | BuildCraft Construction Services | 10 | 28 | Cement, steel, aggregates, blocks and site safety |
| Apparel workshop | Threadline Apparel Workshop | 11 | 30 | Knits, denim, fleece, lining and production trims |
| Restaurant | Savor & Sip Restaurant | 10 | 28 | Meat, seafood, produce, dairy and food-service disposables |

Each company has **24 company-side stock records** (8 each at operational priorities A, B and C), with unique SKU, unit, on-hand quantity, reorder point, target quantity, indicative price and receiving specification. Each preset has **8 fictional suppliers**, each with a named contact, category, product coverage, lead time, minimum order, delivery method and payment/warranty/return/tax terms. Supplier inventory and quotations are limited to each supplier's configured product range; each material has at least one eligible supplier. This produces **69 electronics, 38 bakery, 63 cellphone repair, 56 construction, 50 apparel, and 43 restaurant supplier-item offers** per scenario. Prices, stock and lead times vary by supplier. Every supplier login has three clearly watermarked **SAMPLE** accreditation PDFs (Business Registration, Tax Certificate, Business Permit); these are fictional placeholders, not evidence of real registration.

Activating a company preloads linked, fictional activity across the workflow: **24 requisitions and approval records**, **24 sourcing needs**, the product-range-matched supplier quotations listed above, three proposal meetings, department budgets and approval delegation, eight supplier contracts, three A/B/C recurring plans and a shortage case, matching supplier inventory records, nine purchase orders, nine delivery records covering accepted, partial and in-transit states, three short-delivery investigations, verified receipts and inventory movements, four matched invoices, five payments including a pending hold, eight supplier scorecards, supplier and staff conversations, audit evidence, and transaction PDFs. Every requisition, need, quote, contract, order, delivery and invoice is linked to the selected company's materials, suppliers, departments and generated accounts.

The examples intentionally show different stages instead of marking every requisition completed. The partial delivery, supplier response, contract terms, simulated paid invoice, and sample accreditation are fictional training records—not real transactions, legal documents, supplier approvals, or payment activity. Switching company scenarios replaces the existing demo scenario data in the isolated training workspace.

**Priority A/B/C means operational purchasing urgency**, *not* inventory-value ABC analysis, and not a government **Approved Budget for the Contract (ABC)**:

- **A — critical:** Essential component/ingredient or repair material below its reorder threshold; immediate sourcing attention and technical/quality validation.
- **B — planned:** Normal operating and replenishment supply; competitive purchasing with normal lead times.
- **C — support:** Non-urgent items such as labels, storage supplies and packaging; may be scheduled or consolidated.

A-priority needs **do not** bypass financial approvals, comparison of suppliers, or receiving inspection.

## Safe deployment: use the separate ProcureFlow-Corp account

**Do not activate the training mode on the live Worker/database.** The training Worker uses its own D1 database and KV namespace in the ProcureFlow-Corp Cloudflare account. The personal-account training resources remain separate. Demo seeding requires a signed-in Admin and exact activation confirmation; scenario switching replaces only the records in the isolated training database.

The isolated resources are `procureflow-db-demo` (D1), `procureflow-kv` (KV), Worker `procureflow-training-api`, and Pages project `procureflow-training`. The checked-in `cloudflare/wrangler.demo.toml` targets the ProcureFlow-Corp account and these training-only bindings. Never copy those bindings into `wrangler.toml`.

1. **Install dependencies** from the project root (in Windows PowerShell or a terminal):

   ```bash
   npm install
   cd cloudflare
   npm install
   ```

2. **Verify the dedicated training storage** (from `cloudflare/`):

   ```bash
   npx wrangler d1 list
   npx wrangler kv namespace list
   ```

3. Before deploying the Worker, register the `procureflowcorp.workers.dev` subdomain for this account in Cloudflare Workers & Pages settings. `ENABLE_DEMO_PRESETS="true"` enables the training routes but does not seed data automatically.

4. **Initialize the clean D1 and run the additive migrations** from `cloudflare/`:

   ```bash
   npx wrangler d1 execute procureflow-db-demo --remote --config wrangler.demo.toml --file=../src/db/schema.sql
   npx wrangler d1 migrations apply procureflow-db-demo --remote --config wrangler.demo.toml
   ```

   The separate ProcureFlow-Corp training database is already initialized with migrations `0001` through `0025`. Do not reinitialize it; when upgrading, apply only unapplied migrations. **Never aim these commands at your production database.**

5. **Configure a strong, separate Admin bootstrap secret** (do not put it in source code):

   ```bash
   npx wrangler secret put BOOTSTRAP_SECRET --config wrangler.demo.toml
   npx wrangler deploy --config wrangler.demo.toml
   ```

   On a **brand-new training database**, create the first **Admin** account using the Worker bootstrap endpoint. For this isolated training workspace, the Admin and all generated sample accounts use the shared initial password `password123`:

   ```bash
   curl -X POST "https://procureflow-training-api.procureflowcorp.workers.dev/auth/bootstrap" \
     -H "Content-Type: application/json" \
     -d '{"setupSecret":"YOUR_BOOTSTRAP_SECRET","username":"admin","password":"password123","name":"Training Admin","email":"admin@example.invalid"}'
   ```

   The endpoint can create **only the first account**. For PowerShell, use `curl.exe` or `Invoke-RestMethod` with the corresponding syntax; avoid placing real secrets in shell history.

6. **Build the frontend for the training Worker**, not the original live API:

   ```dotenv
   VITE_API_BASE_URL=https://procureflow-training-api.procureflowcorp.workers.dev
   ```

   `npm run build -- --mode demo --outDir dist-demo` builds to the separate output directory. Deploy it with `npx wrangler pages deploy dist-demo --project-name procureflow-training`; its Pages origin must match `ALLOWED_ORIGIN`. The current Pages origin is `https://procureflow-training-1xx.pages.dev`.

## Training logins

**The Admin and all premade department Head, Officer and supplier accounts start with password `password123`.**

Once a company is activated, go to **Company & Material Setup → Premade department and supplier logins** while signed in as Admin. The full username table appears, including every department and all eight suppliers. The pattern for an Electronics Shop is:

| Role | Login username | Initial password |
| --- | --- | --- |
| Operations Head | `elec.01.head` | `password123` |
| Operations Officer | `elec.01.officer` | `password123` |
| Procurement Head | `elec.02.head` | `password123` |
| Procurement Officer | `elec.02.officer` | `password123` |
| Supplier 1 | `elec.supplier1` | `password123` |
| Supplier 2 | `elec.supplier2` | `password123` |
| Supplier 3 | `elec.supplier3` | `password123` |
| Supplier 4 | `elec.supplier4` | `password123` |

Additional departments have `.03.head`, `.03.officer`, and so on. Each selected company's logins are independently generated with the matching industry prefix. Some common roles (Finance Officer and Operations Officer) receive the corresponding real D1 staff appointments used by the existing role/approval logic. Every department Head is entered in the department's approval assignment table.

This shared, well-known password is **strictly for isolated training**. Anyone who can reach the training site can sign in as Admin until its password is changed. Change the Admin password before wider access, and reset each training account's password after first use. Do not store realistic personal/business data in this workspace. Sample users use fake `.invalid` email addresses, so normal email-verification flows cannot be expected to reach real inboxes.

## Where to find the data

- **Company & Material Setup** — select six industry presets, review the A/B/C company stock and reorder thresholds, supplier business terms, department budgets and supplier/staff credentials (Admin only for the last item).
- **Supplier Stock Directory** — all eight suppliers' separate on-hand, reserved and available inventory and listed prices for each company material. Supplier accounts can update their own catalog according to the original stock-permission logic.
- **Supplier Accreditation** — procurement Admin/Head/Officer can inspect the training accreditation status and open the three **nonlegal** PDF samples for each supplier. Only authorized reviewer roles may approve real submissions. Sample status says Approved with an explicit **DEMO APPROVAL ONLY** note; this is not genuine accreditation.
- **Purchase Requisitions / Bidding and Proposals / Purchase Orders** — 24 linked requisitions, sourcing needs and 192 comparable supplier quotes, with staged approvals and nine example orders.
- **Delivery / Finance / Invoice** — inspected example delivery, matched invoice and fictitious paid transaction; no real payment is made.
- **Departments / Staff Assignments** — generated department Head and Officer accounts, plus the existing permissions, delegation and verification systems.

Only **one company scenario is active per training D1 workspace**. Switching companies intentionally replaces prior **demo** transactions, logins and department allocations. It does **not** implement multi-tenant isolation where each company has simultaneous, independent transactions. If you want to maintain multiple companies concurrently, create separate training Workers/D1 databases or add true company-scoped multi-tenancy; do not switch on a shared live workspace.

The 24 company-side stock records are seeded planning examples and shown **read-only**; supplier stock uses the application's existing editable supplier inventory. To change the example master list long-term, adjust `src/data/demoPresets.ts` and activate a scenario again **only after accepting that training transaction data will be replaced**.

## Private procurement procedure modeled

The example workflow follows the common **procure-to-pay / procurement supply cycle**, with separation of duties:

1. **Need / stock trigger:** A department or Operations detects a stock shortage, project need or service request; defines specifications and required date.
2. **Purchase requisition:** Employee raises a PR; Department Head validates the need and available budget; Finance and executive approval levels apply per the configured financial rules.
3. **Sourcing and supplier evaluation:** Procurement publishes a requirement or RFQ, checks business-registration, tax and permit evidence and eligibility, and asks suppliers to quote. A realistic commercial assessment compares price, lead time, compatibility, warranty, payment and return terms, and reliability rather than choosing on price alone.
4. **Award and commercial terms:** Authorized users evaluate bids, clarify exceptions, negotiate where needed, hold a supplier meeting/proposal discussion, select the supplier, and issue/authorize a purchase order.
5. **Delivery and receiving:** Warehouse/Operations record receipt; technical/quality staff inspect actual quantity and specifications. Shortages and damaged/off-spec materials go through discrepancy and amendment processes.
6. **Invoice matching and payment:** Finance compares the **approved PO, accepted delivery and supplier invoice** (three-way match), checks authorized payment thresholds, and records a payment only when approved.
7. **Closeout and learning:** Procurements are closed, supplier performance is scored, and reorder points and sourcing decisions are reviewed.

Reference: [CIPS procurement and supply cycle](https://1prd-dxp.cips.org/intelligence-hub/procurement/procurement-supply-cycle) and [CIPS procure-to-pay process](https://1prd-dxp.cips.org/intelligence-hub/procurement-technology/procure-to-pay-process). The legal framework in [Philippine RA 12009](https://lawphil.net/statutes/repacts/ra2024/ra_12009_2024.html) covers **government procuring entities** and is **not automatically a rulebook for a private electronics shop, bakery, or repair center**.

## New files and quick validation

- Data blueprint: `src/data/demoPresets.ts`
- Company-side planning and supplier/credentials views: `src/components/DemoCompanyRecords.tsx`
- API-only demo activation, supplier terms/catalog: `cloudflare/src/demoScenarioRoutes.ts`
- Dedicated sample-account hash: `cloudflare/src/demoPasswordHash.ts`
- Safe opt-in schema: `cloudflare/migrations/0025_demo_company_scenarios.sql`
- Worker training config example: `cloudflare/wrangler.demo.example.toml`
- Six-scenario database/auth/inventory/receiving/finance regression test: `tests/demoScenario.integration.cjs`

Validation command after installing dependencies:

```bash
node --test tests/demoScenario.integration.cjs
npm run build
```

The integration test uses an in-memory SQLite/KV D1 substitute to validate the real seed route, scenario switching, authentication hashes, supplier accreditation PDFs, transaction records, and refusal to overwrite a database with ordinary employee accounts. Before deploying in production, test the updated Worker and browser against a *separate* staging database with real Wrangler.
