/**
 * ProcureFlow registration schema repair — NON-DESTRUCTIVE, idempotent.
 * Run from cloudflare/: node scripts/repair-registration-schema.mjs --check
 *                        node scripts/repair-registration-schema.mjs --apply
 *
 * Checks the *remote* Cloudflare D1 table, adds only missing account columns,
 * and never drops, recreates or clears existing tables, records or sessions.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbName = process.env.PROCUREFLOW_D1_NAME || 'procurecorp-db';
if (!/^[a-zA-Z0-9_-]+$/.test(dbName)) {
  throw new Error('Invalid D1 database name.');
}
const mode = process.argv[2] ?? '--check';
if (!['--check', '--apply'].includes(mode)) {
  console.error('Usage: node scripts/repair-registration-schema.mjs [--check | --apply]');
  process.exit(2);
}

// Only static, reviewed SQL is ever sent to D1. No user-entered SQL or account data.
const requiredColumns = [
  ['app_role', "ALTER TABLE users ADD COLUMN app_role TEXT NOT NULL DEFAULT 'Employee' CHECK (app_role IN ('Admin', 'Employee', 'Procurement Officer', 'Procurement Head', 'Supplier'))"],
  ['status', "ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected'))"],
  ['department', "ALTER TABLE users ADD COLUMN department TEXT NOT NULL DEFAULT ''"],
  ['company_name', "ALTER TABLE users ADD COLUMN company_name TEXT NOT NULL DEFAULT ''"],
  ['access_revoked', 'ALTER TABLE users ADD COLUMN access_revoked INTEGER NOT NULL DEFAULT 0 CHECK (access_revoked IN (0, 1))'],
];

function d1(sql) {
  // Run the installed Wrangler CLI directly through Node; this avoids
  // Windows cmd.exe quoting problems with SQL and does not install packages.
  const candidates = [
    resolve(projectDir, 'node_modules/wrangler/bin/wrangler.js'),
    resolve(projectDir, '../node_modules/wrangler/bin/wrangler.js'),
  ];
  const cliPath = candidates.find(path => existsSync(path));
  if (!cliPath) {
    throw new Error('Wrangler is not installed locally. Run `npm install` inside the cloudflare folder first.');
  }
  const args = [cliPath, 'd1', 'execute', dbName, '--remote', '--command', sql, '--json'];
  const result = spawnSync(process.execPath, args, {
    cwd: projectDir, encoding: 'utf8', windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    const detail = (result.stderr || result.stdout || result.error?.message || '').trim();
    throw new Error(`Wrangler command failed. ${detail || 'Check Wrangler login, wrangler.toml D1 ID, and network.'}`);
  }
  const raw = (result.stdout ?? '').trim();
  try { return JSON.parse(raw); }
  catch { throw new Error(`Wrangler did not return valid JSON. Output: ${raw.slice(0, 450)}`); }
}

function rowsOf(result) {
  const blocks = Array.isArray(result) ? result : [result];
  const rows = blocks.flatMap(block => {
    const candidate = block?.results ?? block?.result?.results;
    return Array.isArray(candidate) ? candidate : [];
  });
  return rows;
}

function columns() {
  const result = d1('PRAGMA table_info(users)');
  const rows = rowsOf(result);
  if (!rows.length) {
    throw new Error('The users table was not found or could not be inspected. STOP: do not run the base schema against a production database.');
  }
  const names = rows.map(row => row?.name).filter(name => typeof name === 'string');
  if (!names.includes('id') || !names.includes('username') || !names.includes('role')) {
    throw new Error('Unexpected users table schema. STOP: inspect it manually before making changes.');
  }
  return new Set(names);
}

try {
  console.log(`Checking REMOTE Cloudflare D1: ${dbName}`);
  let existing = columns();
  let missing = requiredColumns.filter(([column]) => !existing.has(column));
  console.log(`Existing columns: ${[...existing].join(', ')}`);
  if (!missing.length) {
    console.log('Registration columns are already present. No schema changes needed.');
  } else {
    console.log(`Missing columns: ${missing.map(([column]) => column).join(', ')}`);
    if (mode === '--apply') {
      console.log('Applying additive schema changes (no records will be removed)...');
      for (const [column, sql] of missing) {
        // Recheck before each ADD to reduce duplicate-column errors if another
        // operator applied a migration between checks.
        existing = columns();
        if (existing.has(column)) continue;
        d1(sql);
        console.log(`  Added ${column}`);
      }
      // Only admin accounts are normalized; existing non-admin roles/statuses
      // are never rewritten by this script.
      d1("UPDATE users SET app_role = 'Admin' WHERE role = 'admin' AND app_role <> 'Admin'");
      missing = requiredColumns.filter(([column]) => !columns().has(column));
      if (missing.length) throw new Error(`Verification failed; still missing ${missing.map(([name]) => name).join(', ')}`);
      console.log('Registration table repaired and verified. Existing users and sessions preserved.');
    } else {
      console.log('Dry run only. Run the same script with --apply to add the missing columns.');
    }
  }
  if (mode === '--check' && !missing.length) console.log('If registration still returns 500, inspect the Worker exception with npx wrangler tail procurecorp-api --format pretty.');
} catch (error) {
  console.error(`Registration repair stopped: ${error.message}`);
  process.exitCode = 1;
}
