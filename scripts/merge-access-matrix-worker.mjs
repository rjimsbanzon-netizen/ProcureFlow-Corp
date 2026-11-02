/** Patch only the existing role list and guard of the Access Control endpoint.
 * This is intentionally a surgical merge; never replace the deployed Worker.
 */
import fs from 'node:fs';
import path from 'node:path';
const target=path.join(process.cwd(),'cloudflare','src','index.ts');
if(!fs.existsSync(target))throw new Error(`Open the ProcureFlow project root first. Missing ${target}`);
const original=fs.readFileSync(target,'utf8');
const mode=process.argv.includes('--check')?'check':'apply';
const rolePattern=/const ACCESS_CONTROL_ROLES = \[[\s\S]*?\] as const;/;
if(!rolePattern.test(original))throw new Error('Could not find the existing access-control role list. No changes made.');
const replacement="const ACCESS_CONTROL_ROLES = [\n  'Admin', 'Procurement Head', 'Procurement Officer', 'Department Head',\n  'Employee', 'Finance Officer', 'Finance Head', 'Supplier'\n] as const;";
let updated=original.replace(rolePattern,replacement);
const anchor="        await env.DB.prepare(\n          `INSERT INTO access_control_settings (id, data, updated_at)";
const block=`        // Enforce non-delegable authorities on the server as well as the UI.
        for (const [role, actions] of Object.entries(normalized)) {
          const sensitive = ['process_payment', 'confirm_payment'];
          for (const action of sensitive) {
            const index = actions.indexOf(action);
            if (role === 'Finance Officer' || role === 'Finance Head') {
              if (index === -1) actions.push(action);
            } else if (index !== -1) actions.splice(index, 1);
          }
          for (const action of ['manage_users', 'manage_permissions']) {
            const index = actions.indexOf(action);
            if (role === 'Admin') {
              if (index === -1) actions.push(action);
            } else if (index !== -1) actions.splice(index, 1);
          }
        }
`;
if(!updated.includes('Enforce non-delegable authorities on the server')){
 if(!updated.includes(anchor))throw new Error('Cannot locate the permissions INSERT point in your Worker. No changes made.');
 updated=updated.replace(anchor,block+anchor);
}
const modified=updated!==original;
if(mode==='check'){
 console.log(modified?'CHECK: Access Control Worker merge is required.':'CHECK: Access Control roles and locks are already integrated.');
 process.exit(0);
}
if(!modified){console.log('Already integrated; no changes made.');process.exit(0)}
const suffix=new Date().toISOString().replace(/[:.]/g,'-');
const backup=`${target}.bak-matrix-${suffix}`;
fs.copyFileSync(target,backup);
fs.writeFileSync(target,updated);
console.log(`Updated ${target}\nBackup: ${backup}\nRun: cd cloudflare && npx wrangler deploy`);
