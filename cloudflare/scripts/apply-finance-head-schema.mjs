/** Safe, re-runnable D1 schema updater for independent Finance Head signoffs.
 * Run from cloudflare/: node scripts/apply-finance-head-schema.mjs --check
 *                      node scripts/apply-finance-head-schema.mjs --apply
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const here=dirname(fileURLToPath(import.meta.url));
const cwd=resolve(here,'..');
const dbName=process.env.PROCUREFLOW_D1_NAME||'procurecorp-db';
if(!/^[A-Za-z0-9_-]+$/.test(dbName))throw new Error('Invalid D1 database name.');
const action=process.argv[2]||'--check';
if(!['--check','--apply'].includes(action))throw new Error('Use --check or --apply.');
const cli=[resolve(cwd,'node_modules/wrangler/bin/wrangler.js'),resolve(cwd,'../node_modules/wrangler/bin/wrangler.js')].find(existsSync);
if(!cli)throw new Error('Missing Wrangler. Run npm install in cloudflare/.');
function query(sql){
  const child=spawnSync(process.execPath,[cli,'d1','execute',dbName,'--remote','--command',sql,'--json'],{cwd,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});
  if(child.status!==0)throw new Error((child.stderr||child.stdout||child.error?.message||'Wrangler failed').trim());
  try {
    const raw=JSON.parse((child.stdout||'').trim());
    return (Array.isArray(raw)?raw:[raw]).flatMap(item=>item?.results||item?.result?.results||[]);
  }catch {throw new Error('Unexpected Wrangler JSON response. Verify Wrangler login and --json support.');}
}
const columns=query('PRAGMA table_info(finance_rules)');
if(!columns.some(c=>c.name==='finance_from_cents'))throw new Error('finance_rules is missing. Apply the earlier 0006_finance_workflows.sql first; do NOT reset D1.');
const hasThreshold=columns.some(c=>c.name==='finance_head_from_cents');
const hasSignoffs=query("SELECT name FROM sqlite_master WHERE type='table' AND name='finance_head_signoffs'").length>0;
console.log(`Remote ${dbName}: Finance Head threshold ${hasThreshold?'installed':'MISSING'}; signoff table ${hasSignoffs?'installed':'MISSING'}.`);
if(action==='--check'){
  console.log('Check only. Apply with --apply if any component is missing.');
}else{
  if(!hasThreshold){
    query('ALTER TABLE finance_rules ADD COLUMN finance_head_from_cents INTEGER NOT NULL DEFAULT 100000000 CHECK (finance_head_from_cents >= 0)');
    console.log('Added Finance Head threshold, default PHP 1,000,000.');
  }
  query("CREATE TABLE IF NOT EXISTS finance_head_signoffs (pr_id TEXT PRIMARY KEY REFERENCES pr_approval_requests(pr_id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')), decided_by TEXT REFERENCES users(id), decided_at TEXT, comment TEXT NOT NULL DEFAULT '')");
  query('CREATE INDEX IF NOT EXISTS idx_finance_head_pending ON finance_head_signoffs(status)');
  console.log('Finance Head schema verified. Existing accounts, workflows and procurement records unchanged.');
}
