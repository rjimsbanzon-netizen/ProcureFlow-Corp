-- Global Search uses existing enterprise_state records (no extra search table).
-- Run after 0010_finance_head_review.sql and 0012_advanced_operations.sql.
-- No destructive changes to existing procurement data.
CREATE TABLE IF NOT EXISTS approval_delegations (
  id TEXT PRIMARY KEY,
  step_role TEXT NOT NULL CHECK (step_role IN ('Procurement Head','Finance Officer','Finance Head')),
  primary_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delegate_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  reason TEXT NOT NULL,
  revoked_at TEXT,
  revoked_by TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (primary_user_id <> delegate_user_id),
  CHECK (starts_on <= ends_on)
);
CREATE INDEX IF NOT EXISTS idx_delegations_active ON approval_delegations(step_role, starts_on, ends_on, revoked_at);
CREATE INDEX IF NOT EXISTS idx_delegations_user ON approval_delegations(delegate_user_id);

CREATE TABLE IF NOT EXISTS procurement_contracts (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  po_id TEXT,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  negotiated_price_cents INTEGER NOT NULL CHECK (negotiated_price_cents >= 0),
  pricing_terms TEXT NOT NULL DEFAULT '',
  renewal_notice_days INTEGER NOT NULL DEFAULT 30 CHECK(renewal_notice_days BETWEEN 1 AND 365),
  notes TEXT NOT NULL DEFAULT '',
  terminated_at TEXT,
  termination_reason TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(starts_on <= ends_on)
);
CREATE INDEX IF NOT EXISTS idx_contracts_end ON procurement_contracts(ends_on);
CREATE INDEX IF NOT EXISTS idx_contracts_supplier ON procurement_contracts(supplier_id);
CREATE TABLE IF NOT EXISTS procurement_contract_renewals (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES procurement_contracts(id) ON DELETE CASCADE,
  previous_ends_on TEXT NOT NULL,
  new_ends_on TEXT NOT NULL,
  previous_price_cents INTEGER NOT NULL,
  new_price_cents INTEGER NOT NULL,
  reason TEXT NOT NULL,
  renewed_by TEXT NOT NULL,
  renewed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contract_renewals_contract ON procurement_contract_renewals(contract_id,renewed_at);
