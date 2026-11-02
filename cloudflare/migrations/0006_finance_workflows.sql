-- Feature 6–8: approvals, department allocations and invoice matching.
-- Safe to apply to the existing Cloudflare D1 database; does not rewrite users or orders.
CREATE TABLE IF NOT EXISTS finance_rules (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  finance_from_cents INTEGER NOT NULL DEFAULT 0 CHECK(finance_from_cents >= 0),
  admin_from_cents INTEGER NOT NULL DEFAULT 0 CHECK(admin_from_cents >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO finance_rules(id,finance_from_cents,admin_from_cents) VALUES(1,0,0);

-- Department Head is department-specific. Finance Officer is company-wide ('*').
-- Existing users retain their original account role; these are workflow responsibilities.
CREATE TABLE IF NOT EXISTS finance_approvers (
  step_role TEXT NOT NULL CHECK(step_role IN ('Department Head','Finance Officer')),
  department TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(step_role, department)
);
CREATE INDEX IF NOT EXISTS idx_finance_approver_user ON finance_approvers(user_id);

CREATE TABLE IF NOT EXISTS department_budgets (
  department TEXT PRIMARY KEY,
  allocated_cents INTEGER NOT NULL CHECK(allocated_cents >= 0),
  updated_by TEXT NOT NULL REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pr_approval_requests (
  pr_id TEXT PRIMARY KEY,
  department TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected')),
  current_step INTEGER NOT NULL DEFAULT 1,
  total_steps INTEGER NOT NULL CHECK(total_steps BETWEEN 2 AND 4),
  requested_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE TABLE IF NOT EXISTS pr_approval_steps (
  pr_id TEXT NOT NULL REFERENCES pr_approval_requests(pr_id) ON DELETE CASCADE,
  step_no INTEGER NOT NULL,
  step_role TEXT NOT NULL CHECK(step_role IN ('Department Head','Procurement Head','Finance Officer','Admin')),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected')),
  decided_by TEXT REFERENCES users(id),
  comment TEXT NOT NULL DEFAULT '',
  decided_at TEXT,
  PRIMARY KEY(pr_id,step_no)
);
CREATE INDEX IF NOT EXISTS idx_pr_steps_pending ON pr_approval_steps(step_role,status);

CREATE TABLE IF NOT EXISTS supplier_invoices (
  id TEXT PRIMARY KEY,
  po_id TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
  invoice_date TEXT NOT NULL,
  document_id TEXT,
  status TEXT NOT NULL DEFAULT 'Submitted' CHECK(status IN ('Submitted','Matched')),
  submitted_by TEXT NOT NULL REFERENCES users(id),
  submitted_at TEXT NOT NULL,
  matched_by TEXT REFERENCES users(id),
  matched_at TEXT,
  UNIQUE(supplier_name,invoice_number)
);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_po ON supplier_invoices(po_id,status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_matched_invoice_per_po
  ON supplier_invoices(po_id) WHERE status='Matched';
