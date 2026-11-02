import test from 'node:test';
import assert from 'node:assert/strict';
import { fixedValue, normalizeMatrix, DEFAULT_MATRIX, workflowRoleChecked } from '../src/domain/accessMatrix.ts';

test('Admin-only account privileges stay locked for other roles', () => {
  for (const role of ['Employee', 'Department Head', 'Finance Officer', 'Supplier']) {
    assert.equal(fixedValue(role, 'manage_users'), false);
    assert.equal(fixedValue(role, 'manage_permissions'), false);
  }
  assert.equal(fixedValue('Admin', 'manage_users'), true);
});
test('supplier bid rights cannot be assigned to an Employee with the matrix', () => {
  const matrix = normalizeMatrix({ Employee: ['submit_bids', 'view_assigned_po', 'process_payment', 'create_pr'] });
  assert.equal(matrix.Employee.includes('submit_bids'), false);
  assert.equal(matrix.Employee.includes('view_assigned_po'), false);
  assert.equal(matrix.Employee.includes('process_payment'), false);
  assert.equal(matrix.Employee.includes('create_pr'), true);
});
test('Finance payment rights are locked to Finance positions', () => {
  for (const role of ['Admin', 'Supplier', 'Procurement Head', 'Employee']) {
    assert.equal(fixedValue(role, 'process_payment'), false);
    assert.equal(fixedValue(role, 'confirm_payment'), false);
  }
  for (const role of ['Finance Officer', 'Finance Head']) {
    assert.equal(fixedValue(role, 'process_payment'), true);
    assert.equal(fixedValue(role, 'confirm_payment'), true);
  }
});
test('role matrix fallback remains defined and Admin controls budgeting', () => {
  assert.ok(DEFAULT_MATRIX.Admin.includes('manage_users'));
  assert.equal(workflowRoleChecked('manage_budget','Admin'), true);
  assert.equal(workflowRoleChecked('manage_budget','Department Head'), false);
  assert.equal(workflowRoleChecked('finance_pr_review','Finance Officer'), true);
  assert.equal(workflowRoleChecked('finance_pr_review','Finance Head'), false);
});
