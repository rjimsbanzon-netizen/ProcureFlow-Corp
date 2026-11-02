-- Editable organization departments and canonical names, safe to rerun.
-- Never drop or overwrite existing PRs, approvals, budgets or user accounts.
CREATE TABLE IF NOT EXISTS organization_departments (
  name TEXT PRIMARY KEY COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO organization_departments(name) VALUES
 ('Human Resources'),('IT Systems'),('Finance & Accounting'),
 ('Procurement'),('Operations'),('Executive');
INSERT OR IGNORE INTO organization_departments(name)
  SELECT TRIM(department) FROM users
  WHERE TRIM(department)<>'' AND LOWER(TRIM(department)) NOT IN ('external vendor','unassigned','*');
INSERT OR IGNORE INTO organization_departments(name)
  SELECT TRIM(department) FROM department_budgets WHERE TRIM(department)<>'';
INSERT OR IGNORE INTO organization_departments(name)
  SELECT TRIM(department) FROM finance_approvers WHERE TRIM(department)<>'' AND department<>'*';
INSERT OR IGNORE INTO organization_departments(name)
  SELECT TRIM(department) FROM pr_approval_requests WHERE TRIM(department)<>'';

-- Link existing Procurement Head to the Procurement department without
-- changing anyone's access role. Admin can reassign the Head afterwards.
INSERT OR IGNORE INTO finance_approvers (step_role,department,user_id)
SELECT 'Department Head','Procurement',id FROM users
WHERE role='employee' AND app_role='Procurement Head' AND status='approved' AND access_revoked=0
ORDER BY updated_at DESC LIMIT 1;
