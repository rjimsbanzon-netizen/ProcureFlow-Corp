/**
 * Safely connect the sourcing API (messages / deadlines / accreditation)
 * without replacing Cloudflare's authentication, finance or document code.
 *
 * Usage (from project root):
 *   node scripts/repair-sourcing-worker.mjs --check
 *   node scripts/repair-sourcing-worker.mjs --apply
 *
 * --apply makes a timestamped index.ts backup and is idempotent.
 */
import fs from 'node:fs';
import path from 'node:path';

const action = process.argv[2];
if (!['--check', '--apply'].includes(action)) {
  console.error('Usage: node scripts/repair-sourcing-worker.mjs --check|--apply');
  process.exitCode = 2;
} else {
  const indexPath = path.resolve('cloudflare/src/index.ts');
  const routesPath = path.resolve('cloudflare/src/sourcingRoutes.ts');
  const migrationPath = path.resolve('cloudflare/migrations/0009_supplier_sourcing.sql');
  for (const file of [indexPath, routesPath, migrationPath]) {
    if (!fs.existsSync(file)) throw Error(`Missing required file: ${file}. Extract the patch ZIP into the project root first.`);
  }

  const before = fs.readFileSync(indexPath, 'utf8');
  let code = before;
  const steps = [];
  const importText = "import { handleSourcingRoutes, validateSourcingSnapshotWrite } from './sourcingRoutes';";
  const financeImport = /^(import\s*\{[^}]*handleFinanceRoutes[^}]*\}\s*from\s*['"]\.\/financeRoutes['"];?)[ \t]*$/m;
  if (!/import\s*\{[^}]*handleSourcingRoutes[^}]*\}\s*from\s*['"]\.\/sourcingRoutes['"]/.test(code)) {
    if (!financeImport.test(code)) throw Error('Could not locate Finance import. Stopped without changing index.ts.');
    code = code.replace(financeImport, '$1\n' + importText);
    steps.push('Added sourcing route import');
  }

  if (!/const\s+sourcingResponse\s*=\s*await\s+handleSourcingRoutes\(/.test(code)) {
    const routeAnchor = /(^[ \t]*const\s+financeResponse\s*=\s*await\s+handleFinanceRoutes\(request,\s*env,\s*user,\s*cors\);\s*\n[ \t]*if\s*\(financeResponse\)\s*return\s+financeResponse;)/m;
    if (!routeAnchor.test(code)) throw Error('Could not locate authenticated finance route block. Stopped without changing index.ts.');
    code = code.replace(routeAnchor, '$1\n\n      // Feature 9-11: authenticated supplier messaging, deadlines, accreditation.\n      const sourcingResponse = await handleSourcingRoutes(request, env, user, cors);\n      if (sourcingResponse) return sourcingResponse;');
    steps.push('Registered /sourcing/* routes after authentication');
  }

  // Ensure new bids cannot bypass the sourcing API via the older snapshot endpoint.
  if (!/validateSourcingSnapshotWrite\s*\(/.test(code)) {
    const financeGuard = /(^[ \t]*if\s*\(financeError\)\s*return\s+json\([^\n]+;)/m;
    if (!financeGuard.test(code)) throw Error('Cannot locate the finance snapshot guard. Stopped without changing index.ts.');
    const guard = `\n        const sourcingError = validateSourcingSnapshotWrite(input, current ? JSON.parse(current.data) as Record<string, unknown> : {}, user);\n        if (sourcingError) return json({ error: sourcingError }, 409, cors);`;
    code=code.replace(financeGuard,'$1'+guard);
    steps.push('Added server-side guard against late/unauthorized bids in snapshot PUT');
  }

  if (!steps.length) {
    console.log('All sourcing API registrations are already present in index.ts.');
    console.log('If /sourcing/messages still fails, inspect Network > Response or check D1 migration.');
  } else if (action === '--check') {
    console.log('Missing integration pieces:');
    for (const step of steps) console.log(' - ' + step);
    console.log('No files were modified. Run --apply to add these pieces.');
  } else {
    const backup = `${indexPath}.bak-${new Date().toISOString().replaceAll(':','-')}`;
    fs.copyFileSync(indexPath, backup);
    fs.writeFileSync(indexPath, code);
    console.log('Integration complete:');
    for (const step of steps) console.log(' - ' + step);
    console.log('Backup: ' + backup);
    console.log('Next: verify migration, run npx wrangler deploy, then retry Supplier Messaging.');
  }
}
