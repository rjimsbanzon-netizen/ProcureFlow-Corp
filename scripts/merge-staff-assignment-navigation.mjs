/** Safely add Staff Assignments tab without overwriting existing 9–11 sourcing features.
 * Run from the repository root: node scripts/merge-staff-assignment-navigation.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const changes = [
  {
    file: 'src/App.tsx',
    exists: "import StaffAssignmentsPage from './pages/StaffAssignmentsPage';",
    before: "import UsersPage from './pages/UsersPage';",
    insert: "import StaffAssignmentsPage from './pages/StaffAssignmentsPage';\n",
  },
  {
    file: 'src/App.tsx',
    exists: "case 'staff_assignments': return <StaffAssignmentsPage />;",
    before: "    case 'users': return <UsersPage />;",
    insert: "    case 'staff_assignments': return <StaffAssignmentsPage />;\n",
  },
  {
    file: 'src/components/Sidebar.tsx',
    exists: "['staff_assignments', 'Staff Assignments', 'fa-user-gear']",
    before: "['users', 'User Verification', 'fa-users-gear']",
    insert: "['staff_assignments', 'Staff Assignments', 'fa-user-gear'],\n      ",
  },
  {
    file: 'src/domain/permissions.ts',
    exists: "case 'staff_assignments': return DB.currentUser.role === 'Admin';",
    before: "        case 'users': return DB.currentUser.role === 'Admin'",
    insert: "        case 'staff_assignments': return DB.currentUser.role === 'Admin';\n",
  }
];

const staged = new Map();
try {
  for (const change of changes) {
    const target = path.join(root, change.file);
    if (!fs.existsSync(target)) throw new Error(`Missing ${change.file}. Run from the ProcureFlow project root.`);
    const source = staged.get(target) ?? fs.readFileSync(target,'utf8');
    if (source.includes(change.exists)) continue;
    const index = source.indexOf(change.before);
    if (index < 0) throw new Error(`Could not find insertion point in ${change.file}: ${change.before}`);
    staged.set(target, source.slice(0,index) + change.insert + source.slice(index));
  }
  if (process.argv.includes('--check')) {
    console.log(`Ready: ${staged.size} files require changes. Existing sourcing modules will be preserved.`);
    process.exit(0);
  }
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  for(const [target,modified] of staged){
    const backup=`${target}.bak-${stamp}`;
    fs.copyFileSync(target,backup);
    fs.writeFileSync(target,modified,'utf8');
    console.log(`UPDATED: ${path.relative(root,target)}\nBACKUP: ${path.relative(root,backup)}`);
  }
  console.log(staged.size===0?'Already applied; no changes made.':'Staff Assignments navigation integrated.');
} catch (error) {console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
