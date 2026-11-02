/**
 * ProcureFlow: restore module visibility rules accidentally overwritten by an
 * older Access Control Matrix patch. This script modifies only the existing
 * `src/domain/permissions.ts` and never overwrites newer application files.
 *
 * Run from the repository root:
 *   node scripts/restore-hidden-modules.mjs --check
 *   node scripts/restore-hidden-modules.mjs --apply
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const permissionPath = path.join(root, 'src', 'domain', 'permissions.ts');
const check = process.argv.includes('--check');
const apply = process.argv.includes('--apply');
if (check === apply) {
  console.error('Use exactly one option: --check OR --apply.');
  process.exit(2);
}
if (!fs.existsSync(permissionPath)) {
  console.error('Missing src/domain/permissions.ts. Run this script from the ProcureFlow project root.');
  process.exit(2);
}

const modules = [
  {
    tab: 'supplier_messages',
    rule: "        case 'supplier_messages': return isSupplier || ['Admin','Procurement Head','Procurement Officer'].includes(DB.currentUser.role);",
    page: 'src/pages/SupplierMessagesPage.tsx',
    service: 'src/services/sourcing.ts',
    label: 'Supplier Messaging'
  },
  {
    tab: 'accreditation',
    rule: "        case 'accreditation': return isSupplier || ['Admin','Procurement Head'].includes(DB.currentUser.role);",
    page: 'src/pages/SupplierAccreditationPage.tsx',
    service: 'src/services/sourcing.ts',
    label: 'Supplier Accreditation'
  },
  {
    tab: 'staff_assignments',
    rule: "        case 'staff_assignments': return DB.currentUser.role === 'Admin';",
    page: 'src/pages/StaffAssignmentsPage.tsx',
    label: 'Staff Assignments'
  }
];

let original = fs.readFileSync(permissionPath, 'utf8');
let result = original;
const switchStart = result.indexOf('switch (tab)');
const anchor = "case 'documents':";
if (switchStart === -1 || result.indexOf(anchor, switchStart) === -1) {
  console.error('Unexpected canAccessTab() structure. No changes made; manual review required.');
  process.exit(2);
}
const switchBody = result.slice(switchStart);
const missing = modules.filter(({tab}) => !new RegExp(`case\\s+[\\"']${tab}[\\"']\\s*:`).test(switchBody));
console.log(`${missing.length} missing module permission rule(s) in src/domain/permissions.ts.`);
for (const module of modules) {
  console.log(`  ${missing.some(m => m.tab === module.tab) ? 'RESTORE' : 'OK'}  ${module.label} (${module.tab})`);
}

if (missing.length) {
  const insertion = missing.map(module => module.rule).join('\n') + '\n';
  const anchorIndex = result.indexOf(anchor, switchStart);
  const lineStart = result.lastIndexOf('\n', anchorIndex) + 1;
  result = result.slice(0, lineStart) + insertion + result.slice(lineStart);
}

// Report other wiring gaps, but never overwrite or silently reconstruct the
// routing, components or Worker. This keeps newer workflow changes safe.
const appPath = path.join(root, 'src', 'App.tsx');
const sidebarPath = path.join(root, 'src', 'components', 'Sidebar.tsx');
const app = fs.existsSync(appPath) ? fs.readFileSync(appPath, 'utf8') : '';
const sidebar = fs.existsSync(sidebarPath) ? fs.readFileSync(sidebarPath, 'utf8') : '';
const issues = [];
for (const module of modules) {
  if (!app.includes(`case '${module.tab}'`)) issues.push(`App.tsx has no route for ${module.label}.`);
  if (!sidebar.includes(`'${module.tab}'`)) issues.push(`Sidebar.tsx has no navigation entry for ${module.label}.`);
  if (!fs.existsSync(path.join(root, module.page))) issues.push(`${module.page} is missing.`);
  if (module.service && !fs.existsSync(path.join(root, module.service))) issues.push(`${module.service} is missing.`);
}
const backendPath = path.join(root, 'cloudflare', 'src', 'index.ts');
if (fs.existsSync(backendPath)) {
  const worker = fs.readFileSync(backendPath, 'utf8');
  if (!worker.includes('handleSourcingRoutes')) issues.push('Worker sourcing route integration may be missing (handleSourcingRoutes not found).');
}
const sourcingPath = path.join(root, 'cloudflare', 'src', 'sourcingRoutes.ts');
if (!fs.existsSync(sourcingPath)) issues.push('cloudflare/src/sourcingRoutes.ts is missing (messaging / accreditation APIs).');

if (issues.length) {
  console.log('\nOther possible integration gaps (not automatically modified):');
  issues.forEach(issue => console.log(`  WARNING: ${issue}`));
} else {
  console.log('\nApp routes, sidebar entries, page files, and sourcing API wiring appear present.');
}
if (check) {
  console.log('\nCheck mode: no files modified.');
  process.exit(issues.length ? 1 : 0);
}
if (missing.length) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `${permissionPath}.bak-${stamp}`;
  fs.copyFileSync(permissionPath, backup);
  fs.writeFileSync(permissionPath, result, 'utf8');
  console.log(`\nPatched: src/domain/permissions.ts\nBackup: ${path.relative(root, backup)}`);
} else {
  console.log('\nPermission rules already present; no changes needed.');
}
if (issues.length) {
  console.log('Review the warnings above before deploying; the module may also be missing from the app or API.');
  process.exitCode = 1;
}
