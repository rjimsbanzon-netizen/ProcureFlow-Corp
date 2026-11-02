"""ProcureFlow: reconcile legacy department budgets with department directory.

Run from repository root:
    python fix_budget_departments.py

Only patches cloudflare/src/financeRoutes.ts. Creates a .bak backup.
"""
from pathlib import Path
import sys

SOURCE = Path('cloudflare/src/financeRoutes.ts')
if len(sys.argv) > 1:
    SOURCE = Path(sys.argv[1])

OLD_LOOKUP = '''async function knownDepartment(env:FinanceEnv,name:string):Promise<string|null>{
  const row=await env.DB.prepare('SELECT name FROM organization_departments WHERE name=? COLLATE NOCASE')
    .bind(name).first<{name:string}>();
  return row?.name??null;
}'''
NEW_LOOKUP = '''async function knownDepartment(env:FinanceEnv,name:string):Promise<string|null>{
  const row=await env.DB.prepare('SELECT name FROM organization_departments WHERE name=? COLLATE NOCASE')
    .bind(name).first<{name:string}>();
  if(row?.name)return row.name;
  // Existing installations may have budgets created before department-directory setup.
  const legacy=await env.DB.prepare('SELECT department FROM department_budgets WHERE department=? COLLATE NOCASE')
    .bind(name).first<{department:string}>();
  return legacy?.department??null;
}'''

OLD_LIST = '''    const rows=(await env.DB.prepare('SELECT name FROM organization_departments ORDER BY name COLLATE NOCASE').all<{name:string}>()).results;
    return reply({departments:rows.map(row=>row.name)},200,cors);'''
NEW_LIST = '''    // Show registered departments and legacy budget departments together.
    const [catalog,budgets]=await Promise.all([
      env.DB.prepare('SELECT name FROM organization_departments ORDER BY name COLLATE NOCASE').all<{name:string}>(),
      env.DB.prepare('SELECT department FROM department_budgets ORDER BY department COLLATE NOCASE').all<{department:string}>()
    ]);
    const merged=new Map<string,string>();
    for(const name of [...catalog.results.map(row=>row.name),...budgets.results.map(row=>row.department)]){
      const cleaned=String(name??'').trim();
      if(cleaned&&!merged.has(cleaned.toLowerCase()))merged.set(cleaned.toLowerCase(),cleaned);
    }
    return reply({departments:[...merged.values()].sort((a,b)=>a.localeCompare(b))},200,cors);'''

OLD_RENAME = '''      env.DB.prepare("UPDATE organization_departments SET name=?,updated_at=datetime('now') WHERE name=? COLLATE NOCASE").bind(newName,oldCanonical)
    ]);
    return reply({ok:true},200,cors);'''
NEW_RENAME = '''      env.DB.prepare("UPDATE organization_departments SET name=?,updated_at=datetime('now') WHERE name=? COLLATE NOCASE").bind(newName,oldCanonical),
      // If the former name existed only in department_budgets, register the new name.
      env.DB.prepare('INSERT OR IGNORE INTO organization_departments(name) VALUES(?)').bind(newName)
    ]);
    return reply({ok:true},200,cors);'''

if not SOURCE.is_file():
    sys.exit(f'Cannot find {SOURCE}. Run this script from the Procurement-System repository root.')
original = SOURCE.read_text(encoding='utf-8')
replacements = [
    ('legacy department lookup', OLD_LOOKUP, NEW_LOOKUP),
    ('merged department listing', OLD_LIST, NEW_LIST),
    ('catalog registration after rename', OLD_RENAME, NEW_RENAME),
]
result = original
for label, old, new in replacements:
    count = result.count(old)
    if count != 1:
        if new in result:
            sys.exit(f'{label} is already patched. No files were modified.')
        sys.exit(f'Cannot safely apply {label}: expected 1 exact match, found {count}. No files were modified.')
    result = result.replace(old, new, 1)
backup = SOURCE.with_name(SOURCE.name + '.bak')
if backup.exists():
    sys.exit(f'Backup {backup} already exists. Rename it before retrying.')
backup.write_text(original, encoding='utf-8')
SOURCE.write_text(result, encoding='utf-8')
print(f'Patched {SOURCE} (3 isolated replacements). Original saved to {backup}.')
print('Next: rebuild/redeploy the Cloudflare Worker. The budget page TSX does not need changing.')
