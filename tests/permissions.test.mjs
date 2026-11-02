// Node 22.16+ can run this with --experimental-strip-types --test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePermissionRole } from '../src/domain/permissionResolution.ts';

const inFinance = department => ['finance', 'finance and accounting', 'finance & accounting'].includes(String(department || '').trim().toLowerCase());
const account = (id, role, department) => ({ id, role, department });
const assign = (user_id, step_role, department) => ({ user_id, step_role, department });
const resolve = (user, assignments = []) => resolvePermissionRole(user, assignments, inFinance);

test('signed-out users receive no role', () => assert.equal(resolve(null), null));
test('fixed Admin and Procurement account roles ignore appointment rows', () => {
  for (const role of ['Admin','Procurement Head','Procurement Officer','Supplier']) {
    assert.equal(resolve(account('u1', role, 'Procurement'), [assign('u1','Finance Officer','*')]), role);
  }
});
test('Department Head requires appointment in the same department', () => {
  const user = account('head1','Employee','IT Systems');
  assert.equal(resolve(user, [assign('head1','Department Head','IT Systems')]), 'Department Head');
  assert.equal(resolve(user, [assign('head1','Department Head','Operations')]), 'Employee');
  assert.equal(resolve(user, [assign('head2','Department Head','IT Systems')]), 'Employee');
});
test('Finance Officer appointment requires Finance home department', () => {
  assert.equal(resolve(account('f1','Employee','Finance & Accounting'), [assign('f1','Finance Officer','*')]), 'Finance Officer');
  assert.equal(resolve(account('f1','Employee','IT Systems'), [assign('f1','Finance Officer','*')]), 'Employee');
});
test('Finance Head appointment requires Finance department', () => {
  assert.equal(resolve(account('fh1','Employee','Finance & Accounting'), [assign('fh1','Department Head','Finance & Accounting')]), 'Finance Head');
  assert.equal(resolve(account('fh1','Employee','Finance & Accounting'), [assign('fh1','Department Head','IT Systems')]), 'Employee');
});
test('Finance Head and Officer on one account do not confer financial permission role', () => {
  assert.equal(resolve(account('f1','Employee','Finance & Accounting'), [assign('f1','Department Head','Finance & Accounting'),assign('f1','Finance Officer','*')]), 'Employee');
});
