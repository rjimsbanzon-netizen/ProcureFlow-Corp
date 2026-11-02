/**
 * ProcureFlow targeted registration repair.
 * Does not replace any Worker routes, frontend screens, or database records.
 * Run from the repository root: node scripts/fix-registration-errors.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const authPath = path.join(repoRoot, 'src/views/auth.ts');
const workerPath = path.join(repoRoot, 'cloudflare/src/index.ts');

function readRequired(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${path.relative(repoRoot, file)}. Copy this script to YOUR project's scripts/ folder first.`);
  }
  return fs.readFileSync(file, 'utf8');
}

try {
  const auth = readRequired(authPath);
  const worker = readRequired(workerPath);

  // In HTML pattern /v mode, hyphens inside character classes must be escaped.
  // Put the hyphen outside the character class to avoid JS string escaping.
  const invalidPattern = 'pattern="[A-Za-z0-9._-]{3,32}"';
  const validPattern = 'pattern="(?:[A-Za-z0-9._]|-){3,32}"';
  const oldCount = auth.split(invalidPattern).length - 1;
  const newCount = auth.split(validPattern).length - 1;
  if (oldCount !== 1 && newCount !== 1) {
    throw new Error('Username pattern is different from the expected version. No files changed; inspect src/views/auth.ts manually.');
  }
  const updatedAuth = oldCount === 1 ? auth.replace(invalidPattern, validPattern) : auth;

  const iterationPattern = /(\bconst\s+PASSWORD_ITERATIONS\s*=\s*)([\d_]+)(\s*;)/g;
  const values = [...worker.matchAll(iterationPattern)];
  if (values.length !== 1) {
    throw new Error('Expected exactly one PASSWORD_ITERATIONS constant. No files changed; inspect cloudflare/src/index.ts manually.');
  }
  const iterations = Number(values[0][2].replaceAll('_', ''));
  if (!Number.isSafeInteger(iterations) || iterations < 1) {
    throw new Error('Invalid PASSWORD_ITERATIONS value. No files changed.');
  }
  const updatedWorker = iterations > 100000
    ? worker.replace(iterationPattern, (_all, prefix, _number, suffix) => `${prefix}100_000${suffix}`)
    : worker;

  const changes = [
    { file: authPath, original: auth, updated: updatedAuth },
    { file: workerPath, original: worker, updated: updatedWorker },
  ];
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (const entry of changes) {
    const relative = path.relative(repoRoot, entry.file);
    if (entry.updated === entry.original) {
      console.log(`ALREADY OK: ${relative}`);
      continue;
    }
    const backup = `${entry.file}.bak-${stamp}`;
    fs.copyFileSync(entry.file, backup, fs.constants.COPYFILE_EXCL);
    fs.writeFileSync(entry.file, entry.updated, 'utf8');
    console.log(`FIXED: ${relative}`);
    console.log(`BACKUP: ${path.relative(repoRoot, backup)}`);
  }
  console.log('\nDone. If both files were already OK but /auth/register still returns 500, run:');
  console.log('  cd cloudflare && npx wrangler tail procurecorp-api --format pretty');
  console.log('Perform a new test registration and inspect its exception.');
} catch (error) {
  console.error('Repair cancelled:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
