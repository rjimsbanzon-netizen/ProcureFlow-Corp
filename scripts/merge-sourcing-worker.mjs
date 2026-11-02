/** Add features 9-11 to an existing, customized Worker without replacing other routes.
 * Usage from repository root: node scripts/merge-sourcing-worker.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
const file=path.resolve('cloudflare/src/index.ts');
if(!fs.existsSync(file))throw Error(`Expected ${file}; run from the project root.`);
const original=fs.readFileSync(file,'utf8');
let source=original;
const importLine="import { handleSourcingRoutes, validateSourcingSnapshotWrite, resetSourcingHistory } from './sourcingRoutes';";
const importAnchor="import { handleFinanceRoutes, validateFinanceSnapshotWrite } from './financeRoutes';";
if(!source.includes(importLine)){
  if(!source.includes(importAnchor))throw Error('Could not find existing finance route import. No files changed; merge the sourcing import manually.');
  source=source.replace(importAnchor,importAnchor+'\n'+importLine);
}
const routeAnchor=`      const financeResponse = await handleFinanceRoutes(request, env, user, cors);\n      if (financeResponse) return financeResponse;`;
const routeBlock=`      // Authenticated sourcing: messaging, deadlines, and accreditation.\n      const sourcingResponse = await handleSourcingRoutes(request, env, user, cors);\n      if (sourcingResponse) return sourcingResponse;`;
if(!source.includes(routeBlock)){
  if(!source.includes(routeAnchor))throw Error('Finance handler insertion point not found; no files changed.');
  source=source.replace(routeAnchor,routeAnchor+'\n\n'+routeBlock);
}
const checkAnchor=`        if (financeError) return json({ error: financeError }, 409, cors);`;
const checkBlock=`        const sourcingError = validateSourcingSnapshotWrite(input, current ? JSON.parse(current.data) as Record<string, unknown> : {}, user);\n        if (sourcingError) return json({ error: sourcingError }, 409, cors);`;
if(!source.includes(checkBlock)){
  if(!source.includes(checkAnchor))throw Error('Snapshot guard insertion point not found; no files changed.');
  source=source.replace(checkAnchor,checkAnchor+'\n'+checkBlock);
}
const saveAnchor=`        await env.DB.prepare("INSERT INTO enterprise_state (id, data, updated_at) VALUES (1, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = datetime('now')").bind(data).run();`;
const resetBlock=`        // A confirmed Admin reset also clears sourcing discussions and deadlines,\n        // but retains supplier accreditation because it belongs to user accounts.\n        const fullSourcingReset = user.role === 'admin' && ['requisitions','orders','stockNeeds','bids','deliveries'].every(key => (input[key] as unknown[]).length === 0)\n          && ['requisitions','orders','stockNeeds','bids','deliveries'].some(key => Array.isArray(current ? JSON.parse(current.data)[key] : []) && (current ? JSON.parse(current.data)[key] : []).length > 0);\n        if (fullSourcingReset) await resetSourcingHistory(env);`;
if(!source.includes(resetBlock)){
  if(!source.includes(saveAnchor))throw Error('Enterprise-state save insertion point not found; no files changed.');
  source=source.replace(saveAnchor,saveAnchor+'\n'+resetBlock);
}
if(source===original){console.log('Sourcing routes already merged; nothing to change.');process.exit(0);}
const backup=`${file}.bak-${new Date().toISOString().replaceAll(':','-')}`;
fs.copyFileSync(file,backup);
fs.writeFileSync(file,source);
console.log(`Merged sourcing routes into ${file}`);
console.log(`Backup: ${backup}`);
console.log('Next: cd cloudflare && npx wrangler deploy');
