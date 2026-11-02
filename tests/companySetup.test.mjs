import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

// Platform-independent TypeScript module loader for Node 22's test runner.
// Avoid esbuild's OS-specific native binary in uploaded Windows projects.
const require = createRequire(import.meta.url);
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  module._compile(compiled, filename);
};
const setupDomain = require('../src/domain/companySetup.ts');

test('six industry setups have complete departments and a 100% allocation plan', () => {
  assert.equal(setupDomain.COMPANY_SETUP_TEMPLATES.length, 6);
  for (const setup of setupDomain.COMPANY_SETUP_TEMPLATES) {
    assert.ok(setup.departments.some(department => department.name === 'Operations'));
    assert.ok(setup.departments.some(department => department.name === 'Procurement'));
    assert.ok(setup.departments.some(department => department.name === 'Finance & Accounting'));
    assert.equal(setup.departments.reduce((sum, department) => sum + department.budgetPercent, 0), 100);
    assert.ok(setup.approvals.financeFrom <= setup.approvals.financeHeadFrom);
    assert.equal(setup.purchaseCategories.length, 8);
    assert.ok(setup.purchaseCategories.every(item =>
      setup.departments.some(department => department.name === item.requestingDepartment)));
  }
});

test('department allocations preserve the exact PHP pool after cent rounding', () => {
  for (const setup of setupDomain.COMPANY_SETUP_TEMPLATES) {
    const allocations = setupDomain.allocateSetupBudget(setup.departments, 100_000_000);
    assert.equal(allocations.reduce((sum, row) => sum + Math.round(row.allocated * 100), 0), 10_000_000_000);
    assert.equal(allocations.length, setup.departments.length);
  }
});

test('invalid budgets and non-100% splits are rejected', () => {
  const departments = setupDomain.COMPANY_SETUP_TEMPLATES[0].departments;
  assert.throws(() => setupDomain.allocateSetupBudget(departments, 0), /positive annual procurement budget/);
  assert.throws(() => setupDomain.allocateSetupBudget(departments.slice(1), 100), /must total 100%/);
});
