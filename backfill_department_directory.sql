-- Repair legacy departments that have budget allocations but no directory entry.
-- Safe/idempotent: adds missing names only; does not alter allocations or transactions.
INSERT OR IGNORE INTO organization_departments (name)
SELECT DISTINCT TRIM(department)
FROM department_budgets
WHERE department IS NOT NULL AND TRIM(department) <> '';
