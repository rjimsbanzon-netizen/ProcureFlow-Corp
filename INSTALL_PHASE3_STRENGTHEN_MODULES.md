# ProcureFlow — Phase 3: Strengthen New Modules

Patch contents: **changed files only**. Apply this to a project that already has the Phase 1 and Phase 2 changes and D1 migrations 0013–0016. Do not extract the ZIP as a standalone application.

## Changes

1. **Global Search:** Groups matches by Purchase Requisition, Purchase Order, Supplier Bid, Supplier, Contract, and other transaction types; marks matching text without injecting HTML; Ctrl/Cmd+K opens Global Search for authorized signed-in accounts.
2. **Approval Delegation:** Checks for circular active/pending delegation chains across roles. D1 audit evidence is recorded when a delegation is requested, approved, rejected, cancelled, or revoked. Existing Department Head, Finance separation-of-duties, and Procurement Head → Procurement Officer eligibility rules remain unchanged.
3. **Contract Management:** Draft contracts can be reviewed and explicitly activated. A contract can link to the winning supplier bid and optional Purchase Order. Server rechecks that the supplier matches and the linked bid is selected/awarded. Drafts are not visible to suppliers and do not generate expiry notifications. Existing contracts default to Published.
4. **Supplier Performance:** Mobile supplier selector, clearer summary cards, and data-coverage explanations. Existing server-calculated performance and pricing methodology remains unchanged.
5. **Notifications:** Bid deadline reminders within 48 hours for unsubmitted supplier bids (requires sourcing deadline sync); temporary delegation start and recent-end notices. Existing contract, approval, meeting, and message notifications remain.

## Required installation

1. Back up the remote Cloudflare D1 database before running a migration.
2. From your project root, extract the files in this ZIP and replace matching files, maintaining paths.
3. Ensure migrations **0013**, **0014**, **0015**, and **0016** were already applied once. Do not rerun them.
4. From the `cloudflare` folder, apply the **new additive migration**:

```bash
npx wrangler d1 execute procureflowcorp-db --remote --file=migrations/0017_contract_workflow_links.sql
npx wrangler deploy
```

5. From the project root, update dependencies for your operating system, build and redeploy your frontend:

```bash
npm install
npm run build
```

6. Refresh the deployed application (Ctrl+Shift+R). For PWA installs, reopen the app after the new service worker refreshes.

### Testing and limitations

- Frontend TypeScript: **passed** (`tsc --noEmit`).
- Cloudflare Worker TypeScript: **passed** (standalone check against Worker types).
- SQLite migrations **0013–0017** applied successfully in order to an empty test database. Existing records retained their Published default.
- Targeted route tests passed for unauthorized/non-winning bid links, draft privacy, activation, double activation and circular delegation blocking.
- Full Vite production build was **not** verified in this Linux environment because the original uploaded Windows dependencies do not contain the optional `@rollup/rollup-linux-x64-gnu` binary. Build on your own machine with normal dependencies.
- Live Cloudflare Worker and deployed database were **not** modified or tested.
- Requisitions / contracts / supplier pricing are not added to a general external search index. Search respects the application's existing tab permissions; D1 continues to authorize protected reads and writes.
- The application still needs to be running for local PWA device alerts; remote background push is not included.
