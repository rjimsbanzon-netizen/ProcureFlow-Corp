-- ProcureFlow: independent Finance Head signoff for new high-value PR workflows.
-- Does not modify existing approval steps or old approvals.
-- Run ONCE on the remote D1 database, after 0006_finance_workflows.sql.
ALTER TABLE finance_rules ADD COLUMN finance_head_from_cents INTEGER NOT NULL DEFAULT 100000000
  CHECK (finance_head_from_cents >= 0);

CREATE TABLE IF NOT EXISTS finance_head_signoffs (
  pr_id TEXT PRIMARY KEY REFERENCES pr_approval_requests(pr_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  decided_by TEXT REFERENCES users(id),
  decided_at TEXT,
  comment TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_finance_head_pending ON finance_head_signoffs(status);
